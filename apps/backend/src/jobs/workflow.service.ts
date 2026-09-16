import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { FlowJob } from 'bullmq'
import { FlowProducerService } from '../queue/flow-producer.service'
import { PrismaService } from '../prisma.service'
import { canTransition, getFlowTemplate } from './workflow-templates'

function withJobData(node: FlowJob, job: { id: string; tenantId: string }): FlowJob {
  return {
    ...node,
    data: { ...node.data, jobId: job.id, tenantId: job.tenantId },
    children: node.children?.map((child) => withJobData(child, job)),
  }
}

@Injectable()
export class WorkflowService {
  constructor(
    private readonly flowProducerService: FlowProducerService,
    private readonly prisma: PrismaService,
  ) {}

  async createFlowForJob(jobId: string, tenantId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')
    return this.flowProducerService.add(withJobData(getFlowTemplate(job.type), job))
  }

  async reportProgress(jobId: string, tenantId: string, stage: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')
    const from = job.stage ?? 'queued'
    if (!canTransition(job.type, from, stage)) {
      throw new BadRequestException(`非法状态转移: ${from} -> ${stage}`)
    }
    const status = ['success', 'failure', 'cancelled'].includes(stage) ? stage : 'active'
    const updated = await this.prisma.job.update({
      where: { id: job.id },
      data: {
        status,
        stage,
        checkpointStage: ['success', 'failure', 'cancelled'].includes(stage) ? job.checkpointStage : stage,
      },
    })
    await this.prisma.jobEvent.create({
      data: { jobId: job.id, type: 'stage', data: { stage } },
    })
    return updated
  }
}

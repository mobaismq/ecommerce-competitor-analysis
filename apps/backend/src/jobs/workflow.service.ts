import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import { PrismaService } from '../prisma.service'
import { LocalJobQueueService } from '../queue/local-job-queue.service'
import { canTransition, getFlowTemplate, type WorkflowNode } from './workflow-templates'

@Injectable()
export class WorkflowService {
  constructor(
    private readonly localQueue: LocalJobQueueService,
    private readonly prisma: PrismaService,
  ) {}

  async createFlowForJob(jobId: string, tenantId: string) {
    const job = await this.prisma.job.findFirst({ where: { id: jobId, tenantId } })
    if (!job) throw new NotFoundException('任务不存在')
    const template = getFlowTemplate(job.type)
    const queueName = template.steps[0]?.queueName ?? 'server-ai'
    await this.localQueue.enqueue(queueName, { jobId: job.id, tenantId: job.tenantId, type: job.type })
    return { jobId: job.id, queued: true, queueName }
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

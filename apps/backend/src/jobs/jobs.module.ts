import { Module } from '@nestjs/common'
import { AuthModule } from '../auth/auth.module'
import { PrismaModule } from '../prisma.module'
import { QueueModule } from '../queue/queue.module'
import { JobController } from './job.controller'
import { CollectionJobController } from './collection-job.controller'
import { CollectionJobService } from './collection-job.service'
import { JobSseController } from './job-sse.controller'
import { JobService } from './job.service'
import { WorkflowController } from './workflow.controller'
import { WorkflowService } from './workflow.service'

@Module({
  imports: [AuthModule, PrismaModule, QueueModule],
  controllers: [JobController, WorkflowController, JobSseController, CollectionJobController],
  providers: [JobService, WorkflowService, CollectionJobService],
  exports: [JobService, WorkflowService, CollectionJobService],
})
export class JobsModule {}

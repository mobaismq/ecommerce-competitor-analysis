import { Controller, Param, Sse, UseGuards } from '@nestjs/common'
import type { MessageEvent } from '@nestjs/common'
import { Observable } from 'rxjs'
import { JwtAuthGuard } from '../auth/jwt-auth.guard'
import { PermissionGuard } from '../auth/permission.guard'
import { PrismaService } from '../prisma.service'

const HEARTBEAT_INTERVAL_MS = 15000
const POLL_INTERVAL_MS = 5000

@Controller('jobs')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class JobSseController {
  constructor(private readonly prisma: PrismaService) {}

  @Sse(':id/events')
  events(@Param('id') jobId: string): Observable<MessageEvent> {
    return new Observable<MessageEvent>((subscriber) => {
      let cancelled = false
      let lastHeartbeat = 0
      const seen = new Set<string>()

      const poll = async (initial = false) => {
        if (cancelled) return
        const job = await this.prisma.job.findUnique({ where: { id: jobId } })
        if (!job) {
          subscriber.error(new Error('job not found'))
          return
        }
        if (initial) {
          lastHeartbeat = Date.now()
          subscriber.next({
            data: {
              id: 'snapshot',
              type: 'snapshot',
              data: { status: job.status, stage: job.stage },
            },
          })
        }
        const events = await this.prisma.jobEvent.findMany({
          where: { jobId },
          orderBy: { createdAt: 'asc' },
          take: 100,
        })
        let emitted = false
        for (const event of events) {
          if (!seen.has(event.id)) {
            seen.add(event.id)
            emitted = true
            subscriber.next({
              data: {
                id: event.id,
                type: event.type,
                data: event.data ?? {},
              },
            })
          }
        }
        if (Date.now() - lastHeartbeat >= HEARTBEAT_INTERVAL_MS) {
          lastHeartbeat = Date.now()
          subscriber.next({ data: { id: 'heartbeat', type: 'heartbeat', data: {} } })
        }
      }

      void poll(true)
      const timer = setInterval(() => void poll(), POLL_INTERVAL_MS)
      return () => {
        cancelled = true
        clearInterval(timer)
      }
    })
  }
}

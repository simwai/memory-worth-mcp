import 'reflect-metadata'
import { Column, Entity, PrimaryColumn } from 'typeorm'

@Entity('sessions')
export class SessionEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string

  @Column({ type: 'text' })
  project!: string

  @Column({ type: 'integer', name: 'started_at' })
  startedAt!: number

  @Column({ type: 'integer', name: 'last_active_at' })
  lastActiveAt!: number

  @Column({ type: 'text', name: 'metadata' })
  metadata!: string
}

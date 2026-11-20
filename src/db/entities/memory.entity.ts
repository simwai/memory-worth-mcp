import 'reflect-metadata'
import { Column, Entity, Index, PrimaryColumn } from 'typeorm'

@Entity('memories')
@Index(['project'])
@Index(['scope'])
@Index(['status'])
@Index(['trustScore'])
@Index(['appliesWhen'])
export class MemoryEntity {
  @PrimaryColumn({ type: 'text' })
  id!: string

  @Column({ type: 'text' })
  project!: string

  @Column({ type: 'text' })
  scope!: 'project' | 'global'

  @Column({ type: 'text' })
  content!: string

  @Column({ type: 'text', name: 'applies_when' })
  appliesWhen!: string

  @Column({ type: 'text' })
  tags!: string

  @Column({ type: 'real', name: 'trust_score' })
  trustScore!: number

  @Column({ type: 'text', name: 'trust_label' })
  trustLabel!: 'high' | 'low' | 'unproven'

  @Column({ type: 'text', name: 'evidence_refs' })
  evidenceRefs!: string

  @Column({ type: 'integer', name: 'created_at' })
  createdAt!: number

  @Column({ type: 'integer', name: 'updated_at' })
  updatedAt!: number

  @Column({ type: 'text' })
  status!: 'active' | 'archived' | 'superseded'

  @Column({ type: 'text', name: 'superseded_by', nullable: true })
  supersededBy!: string | null

  @Column({ type: 'text', name: 'session_id', nullable: true })
  sessionId!: string | null
}

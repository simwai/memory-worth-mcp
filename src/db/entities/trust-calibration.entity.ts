import 'reflect-metadata'
import { Column, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

@Entity('trust_calibration')
@Index(['memoryId'])
export class TrustCalibrationEntity {
  @PrimaryGeneratedColumn({ type: 'integer' })
  id!: number

  @Column({ type: 'text', name: 'memory_id' })
  memoryId!: string

  @Column({ type: 'text' })
  outcome!: 'success' | 'failure' | 'neutral'

  @Column({ type: 'integer', name: 'recorded_at' })
  recordedAt!: number
}

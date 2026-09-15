import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../users/user.entity';

/** Etiquetas en la UI: Pendiente / En curso / Hecho. */
export enum NoteStatus {
  PENDING = 'pending',
  IN_PROGRESS = 'in_progress',
  DONE = 'done',
}

/**
 * Mapea la tabla `notes`, creada por la migración InitialSchema. Los nombres de las
 * restricciones coinciden con los que genera PostgreSQL para ese SQL, de modo que TypeORM
 * no detecta diferencias entre entidades y esquema.
 */
@Entity({ name: 'notes' })
@Check('notes_pos_x_check', '"pos_x" >= 0')
@Check('notes_pos_y_check', '"pos_y" >= 0')
export class Note {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Column({ type: 'text', default: '' })
  body: string;

  @Column({
    type: 'enum',
    enum: NoteStatus,
    enumName: 'note_status',
    default: NoteStatus.PENDING,
  })
  status: NoteStatus;

  @Column({ name: 'pos_x', type: 'integer', default: 40 })
  x: number;

  @Column({ name: 'pos_y', type: 'integer', default: 40 })
  y: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'created_by',
    foreignKeyConstraintName: 'notes_created_by_fkey',
  })
  createdBy?: User | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedById: string | null;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({
    name: 'updated_by',
    foreignKeyConstraintName: 'notes_updated_by_fkey',
  })
  updatedBy?: User | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}

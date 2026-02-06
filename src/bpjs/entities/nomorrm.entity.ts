import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('nomorrm')
export class Nomorrm {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    pasien_id: number;

    @Column({ nullable: true })
    no_rm: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

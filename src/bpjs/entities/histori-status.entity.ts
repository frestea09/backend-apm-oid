import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('histori_status')
export class HistoriStatus {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    registrasi_id: number;

    @Column({ nullable: true })
    status: string;

    @Column({ nullable: true })
    poli_id: number;

    @Column({ nullable: true })
    bed_id: number;

    @Column({ nullable: true })
    pengirim_rujukan: number;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

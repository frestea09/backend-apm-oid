import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('historikunjungan_irjs')
export class HistorikunjunganIRJ {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    registrasi_id: number;

    @Column({ nullable: true })
    pasien_id: number;

    @Column({ nullable: true })
    poli_id: number;

    @Column({ nullable: true })
    dokter_id: number;

    @Column({ nullable: true })
    user: string;

    @Column({ nullable: true })
    pengirim_rujukan: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

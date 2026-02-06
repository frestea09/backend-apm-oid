import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('antrian_poli')
export class AntrianPoli {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    nomor: number;

    @Column({ nullable: true })
    suara: string;

    @Column({ nullable: true })
    status: number;

    @Column({ nullable: true })
    panggil: number;

    @Column({ nullable: true })
    poli_id: number;

    @Column({ nullable: true, type: 'date' })
    tanggal: string;

    @Column({ nullable: true })
    loket: string;

    @Column({ nullable: true })
    kelompok: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

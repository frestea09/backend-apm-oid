import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('histori_pengunjung')
export class Historipengunjung {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    registrasi_id: number;

    @Column({ nullable: true })
    pasien_id: number;

    @Column({ nullable: true })
    pengirim_rujukan: number;

    @Column({ nullable: true })
    politipe: string;

    @Column({ nullable: true })
    status_pasien: string;

    @Column({ nullable: true })
    user: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

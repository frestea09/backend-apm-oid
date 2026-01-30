import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('registrasis')
export class Registrasi {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    reg_id: string;

    @Column({ nullable: true })
    pasien_id: number;

    @Column({ nullable: true })
    dokter_id: number;

    @Column({ nullable: true })
    poli_id: number;

    @Column({ nullable: true })
    antrian_poli_id: number;

    @Column({ nullable: true })
    status: number;

    @Column({ nullable: true })
    bayar: string;

    @Column({ nullable: true })
    no_jkn: string;

    @Column({ nullable: true })
    no_rujukan: string;

    @Column({ nullable: true })
    jenis_pasien: string;

    @Column({ nullable: true })
    posisiberkas_id: string;

    @Column({ nullable: true })
    pengirim_rujukan: string;

    @Column({ nullable: true })
    status_reg: string;

    @Column({ nullable: true })
    input_from: string;

    @Column({ nullable: true })
    nomorantrian: string;

    @Column({ nullable: true })
    nomorantrian_jkn: string;

    @Column({ nullable: true })
    antrian_poli: number;

    @Column({ nullable: true })
    no_sep: string;

    @Column({ nullable: true })
    tgl_sep: string;

    @Column({ nullable: true })
    diagnosa_awal: string;

    @Column({ nullable: true })
    tgl_rujukan: string;

    @Column({ nullable: true })
    ppk_rujukan: string;

    @Column({ nullable: true })
    nomorrujukan: string;

    @Column({ nullable: true })
    poli_bpjs: string;

    @Column({ nullable: true })
    hakkelas: string;

    @Column({ nullable: true })
    catatan: string;

    @Column({ nullable: true })
    kecelakaan: string;

    @Column({ nullable: true })
    jenis_kunjungan: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;

    @Column({ nullable: true, type: 'timestamp' })
    deleted_at: Date;
}

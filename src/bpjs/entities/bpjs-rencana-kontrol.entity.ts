import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('bpjs_rencana_kontrol')
export class BpjsRencanaKontrol {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    registrasi_id: number;

    @Column({ nullable: true })
    resume_id: number;

    @Column({ length: 100, nullable: true })
    no_surat_kontrol: string;

    @Column({ nullable: true })
    dokter_id: number;

    @Column({ nullable: true })
    poli_id: number;

    @Column({ nullable: true })
    pasien_id: number;

    @Column({ type: 'date', nullable: true })
    tgl_rencana_kontrol: string;

    @Column({ type: 'tinyint', default: 0, nullable: true })
    month_only: number;

    @Column({ nullable: true })
    user_id: number;

    @Column({ length: 100, nullable: true })
    no_sep: string;

    @Column({ length: 200, nullable: true })
    no_rujukan: string;

    @Column({ name: 'tujuanKunj', length: 200, nullable: true })
    tujuanKunj: string;

    @Column({ name: 'flagProcedure', length: 200, nullable: true })
    flagProcedure: string;

    @Column({ name: 'kdPenunjang', length: 200, nullable: true })
    kdPenunjang: string;

    @Column({ name: 'assesmentPel', length: 200, nullable: true })
    assesmentPel: string;

    @Column({ length: 255, nullable: true })
    diagnosa_awal: string;

    @Column({ length: 200, nullable: true })
    input_from: string;

    @Column({ type: 'longtext', nullable: true })
    tte: string;

    @Column({ type: 'timestamp', nullable: true })
    created_at: Date;

    @Column({ type: 'timestamp', nullable: true })
    updated_at: Date;
}

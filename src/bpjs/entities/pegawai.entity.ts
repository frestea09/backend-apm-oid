import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('pegawai')
export class Pegawai {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    nama: string;

    @Column({ nullable: true })
    kode_bpjs: string; // HFIS code
}

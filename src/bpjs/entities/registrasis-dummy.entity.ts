import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('registrasis_dummy')
export class RegistrasisDummy {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'kodebooking' })
    kodebooking: string;

    @Column({ name: 'no_rm' })
    no_rm: string;

    @Column({ name: 'nomorkartu' })
    nomorkartu: string; // BPJS Card Number

    @Column({ name: 'nik' })
    nik: string;

    @Column({ name: 'keterangan', nullable: true })
    keterangan: string;

    @Column({ name: 'nomorantrian', nullable: true })
    nomorantrian: string;

    @Column({ name: 'tglperiksa', type: 'date', nullable: true })
    tglperiksa: string;

    @Column({ name: 'status', nullable: true })
    status: string;

    @Column({ name: 'registrasi_id', nullable: true })
    registrasi_id: number;

    // Add other columns if necessary, but these are the ones relevant for search
}

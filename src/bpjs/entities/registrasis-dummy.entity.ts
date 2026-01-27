import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('registrasis_dummy')
export class RegistrasisDummy {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ name: 'kodebooking' })
    kodebooking: string;

    @Column({ name: 'norm' })
    norm: string;

    @Column({ name: 'nomorkartu' })
    nomorkartu: string; // BPJS Card Number

    @Column({ name: 'nik' })
    nik: string;

    @Column({ name: 'keterangan', nullable: true })
    keterangan: string;

    @Column({ name: 'nomorantrean', nullable: true })
    nomorantrean: string;

    // Add other columns if necessary, but these are the ones relevant for search
}

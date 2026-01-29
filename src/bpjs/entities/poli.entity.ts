import { Entity, Column, PrimaryGeneratedColumn } from 'typeorm';

@Entity('polis')
export class Poli {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    nama: string;

    @Column({ nullable: true })
    politype: string;

    @Column({ nullable: true })
    bpjs: string;

    @Column({ nullable: true })
    loket: string;

    @Column({ nullable: true })
    kelompok: string;

    @Column({ nullable: true })
    kuota_online: number;

    @Column({ nullable: true })
    kuota: number;
}

import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('pasiens')
export class Pasien {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ nullable: true })
    no_rm: string;

    @Column({ nullable: true })
    nama: string;

    @Column({ nullable: true })
    nik: string;

    @Column({ nullable: true })
    tmplahir: string;

    @Column({ nullable: true, type: 'date' })
    tgllahir: string;

    @Column({ nullable: true })
    kelamin: string;

    @Column({ nullable: true, type: 'text' })
    alamat: string;

    @Column({ nullable: true })
    nohp: string;

    @Column({ nullable: true })
    notlp: string;

    @Column({ nullable: true })
    negara: string;

    @Column({ nullable: true })
    no_jkn: string;

    @Column({ nullable: true })
    jkn: string;

    @Column({ nullable: true })
    rt: string;

    @Column({ nullable: true })
    rw: string;

    @Column({ nullable: true })
    user_create: string;

    @Column({ nullable: true })
    user_update: string;

    @Column({ nullable: true, type: 'date' })
    tgldaftar: string;

    @CreateDateColumn()
    created_at: Date;

    @UpdateDateColumn()
    updated_at: Date;
}

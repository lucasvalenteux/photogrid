'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { Badge, Button } from '@photogrid/ui';

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10 bg-radial-brand" aria-hidden="true" />
      <div className="absolute inset-0 -z-10 bg-grid opacity-60" aria-hidden="true" />

      <div className="container-app pt-24 pb-20 md:pt-32 md:pb-28">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: [0.165, 0.84, 0.44, 1] }}
          className="mx-auto flex max-w-3xl flex-col items-center text-center"
        >
          <Badge variant="brand" className="mb-6">
            <Sparkles className="size-3" />
            Para fotógrafos que querem profissionalizar
          </Badge>

          <h1 className="text-balance text-4xl font-semibold tracking-tight text-ink sm:text-5xl md:text-6xl">
            Onde sua fotografia vira{' '}
            <span className="text-brand-500">um negócio</span>.
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-base text-muted-foreground sm:text-lg">
            Hospede galerias, compartilhe por link e venda fotos com poucos cliques. Sem
            planilhas, sem ligações cobrando entrega, sem fricção.
          </p>

          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="w-full sm:w-auto">
              <Link href={ROUTES.login}>
                Começar agora
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild variant="ghost" size="lg" className="w-full sm:w-auto">
              <Link href="#como-funciona">Ver como funciona</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            Grátis para começar · Sem cartão de crédito · Configuração em 2 minutos
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 32 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2, ease: [0.165, 0.84, 0.44, 1] }}
          className="mx-auto mt-16 max-w-5xl"
        >
          <HeroPreview />
        </motion.div>
      </div>
    </section>
  );
}

function HeroPreview() {
  // Lightweight, dependency-free preview "browser frame" — no external images.
  return (
    <div className="relative rounded-2xl border border-border bg-card p-2 shadow-xl">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <span className="size-2.5 rounded-full bg-line" />
        <div className="ml-3 hidden h-6 flex-1 items-center rounded-md bg-muted px-3 text-[11px] text-muted-foreground sm:flex">
          photogrid.store/maria-fotografia
        </div>
      </div>
      <div className="rounded-xl bg-surface p-4 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-muted-foreground">Galeria</p>
            <h3 className="text-lg font-semibold tracking-tight text-ink">
              3º Ano A — Formatura 2026
            </h3>
          </div>
          <Badge variant="success">Publicado</Badge>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div
              key={idx}
              className="aspect-square rounded-lg"
              style={{
                background: `linear-gradient(135deg, hsl(${(idx * 33) % 360} 50% 88%), hsl(${
                  (idx * 33 + 60) % 360
                } 60% 78%))`,
              }}
              aria-hidden="true"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

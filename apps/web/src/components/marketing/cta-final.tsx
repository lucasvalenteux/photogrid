'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';

import { ROUTES } from '@photogrid/config';
import { Button } from '@photogrid/ui';

export function CtaFinal() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="container-app">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={{ duration: 0.45 }}
          className="relative isolate mx-auto max-w-4xl overflow-hidden rounded-3xl border border-border bg-card p-10 text-center shadow-xl sm:p-16"
        >
          <div className="absolute inset-0 -z-10 bg-radial-brand" aria-hidden="true" />
          <h2 className="text-balance text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
            Pronta para transformar suas fotos em vendas?
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-pretty text-muted-foreground">
            Comece grátis hoje. Configure seu estúdio em 2 minutos e suba sua primeira
            galeria agora.
          </p>
          <div className="mt-8 flex justify-center">
            <Button asChild size="lg">
              <Link href={ROUTES.login}>
                Começar agora
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Button } from "@bit-n-build-2026/ui/components/button";
import { ArrowRight, Search, ShieldCheck, Database, Scale, BookOpen, Activity, ChevronRight, BarChart2, Bitcoin, LineChart, PieChart, TrendingUp, TrendingDown, Layers } from "lucide-react";

export function LandingPage() {
  return (
    <main className="flex-1 flex flex-col items-center min-h-screen overflow-x-hidden bg-background relative w-full">
      {/* Absolute Background Elements for Over-the-top feel */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-blue-500/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-purple-500/10 blur-[120px]" />
      </div>

      {/* Spiderman swinging from the top left corner */}
      <motion.div 
        initial={{ opacity: 0, x: -50, y: -50, rotate: -15 }}
        animate={{ opacity: 1, x: 0, y: 0, rotate: 0 }}
        transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }}
        className="absolute top-0 left-0 z-0 pointer-events-none drop-shadow-2xl"
      >
        <img 
          src="/spiderman.png" 
          alt="Spiderman swinging" 
          className="w-64 sm:w-80 md:w-96 lg:w-[500px] h-auto rounded-3xl opacity-90" 
        />
      </motion.div>

      <div className="max-w-7xl w-full mx-auto px-6 md:px-12 py-12 md:py-24 space-y-40">
        
        {/* Massive Hero Section */}
        <section className="relative min-h-[80vh] flex flex-col justify-center pt-24">
          
          {/* HUGE THWIP Background Text - Moved up so it doesn't interfere */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 50 }}
            animate={{ opacity: 1, scale: 1, y: -80 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-[-5%] left-0 w-full flex justify-center -z-10 pointer-events-none select-none opacity-[0.04] dark:opacity-[0.03]"
          >
            <h1 className="text-[28vw] font-black tracking-tighter leading-none m-0 p-0">THWIP</h1>
          </motion.div>

          {/* Centered THWIP Logo - Massive Scale */}
          <motion.div 
            initial={{ opacity: 0, y: -20, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full flex justify-center mb-8 md:mb-12 -mt-8 md:-mt-12 relative z-20 drop-shadow-2xl"
          >
            <div 
              className="h-32 sm:h-48 md:h-64 lg:h-[220px] xl:h-[260px] w-full max-w-[1000px] bg-white"
              style={{
                WebkitMaskImage: 'url(/thwip-logo-transparent.png)',
                maskImage: 'url(/thwip-logo-transparent.png)',
                WebkitMaskSize: 'contain',
                maskSize: 'contain',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
                WebkitMaskPosition: 'center',
                maskPosition: 'center'
              }}
            />
          </motion.div>

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            {/* Hero Text Left-Aligned */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="space-y-10 relative z-10 lg:col-span-12 flex flex-col items-start text-left max-w-4xl"
            >
              {/* Logo has been moved up and centered globally */}
              
              <h1 className="text-4xl sm:text-6xl md:text-8xl lg:text-7xl xl:text-[6rem] font-black tracking-tighter text-foreground leading-[1.05] break-words hyphens-auto w-full">
                THINK <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-primary">
                  FUNDAMENTALLY.
                </span>
              </h1>
              
              <p className="text-lg md:text-2xl text-muted-foreground leading-relaxed font-medium">
                We don't tell you what to buy. We stress-test <span className="text-foreground underline decoration-primary decoration-4 underline-offset-4">why</span> you want to buy it — and show you every source we used.
              </p>
              
              <div className="pt-4 flex flex-col sm:flex-row items-center sm:justify-start gap-6 w-full">
                <Link href="/login" className="w-full sm:w-auto">
                  <Button size="lg" className="w-full sm:w-auto h-16 px-12 text-xl font-bold rounded-full shadow-[0_0_40px_rgba(var(--primary),0.3)] hover:shadow-[0_0_60px_rgba(var(--primary),0.5)] hover:scale-105 active:scale-95 transition-all duration-300">
                    Start your investigation
                    <ArrowRight className="ml-3 w-6 h-6" />
                  </Button>
                </Link>
                <div className="flex items-center gap-4 text-sm font-semibold text-muted-foreground uppercase tracking-widest">
                  <Activity className="w-5 h-5 text-primary" />
                  Live Market Data
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Visual Showcase Showcase Section */}
        <section className="space-y-16">
          <div className="text-center space-y-6">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter">DATA THAT SPEAKS</h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto font-medium">
              From global crypto markets to local equities, we synthesize raw fundamentals into beautiful, verifiable insights.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 auto-rows-[250px]">
            {/* Stock Chart Tile */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.1 }}
              className="col-span-1 lg:col-span-2 row-span-1 bg-card rounded-3xl border border-border p-8 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="relative z-10 flex flex-col h-full justify-between">
                <div>
                  <h3 className="font-bold text-2xl flex items-center gap-3"><LineChart className="w-8 h-8 text-blue-500" /> Sector Comparison</h3>
                  <p className="text-muted-foreground mt-2">P/E vs Industry Average</p>
                </div>
                {/* CSS Graph Representation */}
                <div className="flex items-end gap-2 h-24 w-full">
                  {[40, 70, 45, 90, 60, 100, 80, 50, 75, 40].map((h, i) => (
                    <motion.div 
                      key={i}
                      initial={{ height: 0 }}
                      whileInView={{ height: `${h}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: i * 0.05 }}
                      className="flex-1 bg-blue-500/20 rounded-t-sm hover:bg-blue-500 transition-colors"
                    />
                  ))}
                </div>
              </div>
            </motion.div>

            {/* Crypto Tile */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 }}
              className="bg-card rounded-3xl border border-border p-8 relative overflow-hidden group flex flex-col items-center justify-center text-center"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-orange-500/10 to-amber-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center mb-4">
                <Bitcoin className="w-10 h-10 text-orange-500" />
              </div>
              <h3 className="font-bold text-2xl">Crypto Context</h3>
              <p className="text-muted-foreground mt-2 font-medium">Verify on-chain claims against real market cap.</p>
            </motion.div>

            {/* Doodle Tile */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3 }}
              className="bg-primary text-primary-foreground rounded-3xl p-8 flex flex-col justify-between relative overflow-hidden group"
            >
              <div className="absolute right-[-20%] top-[-20%] opacity-20">
                <PieChart className="w-64 h-64" />
              </div>
              <h3 className="font-black text-4xl leading-none">NO<br/>BS.</h3>
              <p className="font-medium text-primary-foreground/80 mt-4 text-lg">Just raw data, cited clearly, for you to draw your own conclusions.</p>
            </motion.div>

            {/* Fundamentals Tile */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.4 }}
              className="col-span-1 lg:col-span-2 bg-card rounded-3xl border border-border p-8 relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-t from-emerald-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="flex flex-col md:flex-row h-full md:items-center justify-between gap-6">
                <div className="space-y-4 max-w-sm">
                  <h3 className="font-bold text-2xl flex items-center gap-3"><Layers className="w-8 h-8 text-emerald-500" /> Deep Fundamentals</h3>
                  <p className="text-muted-foreground">We pull SEC filings, quarterly results, and government data directly into your workspace.</p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border shadow-sm">
                    <TrendingUp className="w-6 h-6 text-emerald-500" />
                    <div>
                      <div className="font-bold">EBITDA Margin</div>
                      <div className="text-sm text-muted-foreground">Outperforming peers</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 bg-background p-4 rounded-xl border border-border shadow-sm">
                    <TrendingDown className="w-6 h-6 text-rose-500" />
                    <div>
                      <div className="font-bold">Debt to Equity</div>
                      <div className="text-sm text-muted-foreground">High risk identified</div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* The Problem & Insight - Full Width Banner */}
        <motion.section
          initial={{ opacity: 0, y: 40 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-100px" }}
          transition={{ duration: 0.7 }}
          className="relative rounded-[3rem] overflow-hidden bg-foreground text-background p-12 md:p-24 shadow-2xl text-center md:text-left"
        >
          <div className="absolute inset-0 opacity-[0.03] mix-blend-overlay pointer-events-none" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }}></div>
          
          <div className="grid md:grid-cols-2 gap-16 items-center relative z-10">
            <div>
              <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-[1.1]">
                THE HYPE <br/><span className="text-primary">STOPS HERE.</span>
              </h2>
            </div>
            <div className="space-y-8 text-xl md:text-2xl font-medium leading-relaxed opacity-90">
              <p>
                Financial literacy isn't just knowing what P/E or EPS stands for. It's knowing how to evaluate a claim like <span className="italic text-primary">"The government increased defense spending, so I want to buy HAL."</span>
              </p>
              <p>
                THWIP turns a beginner's investment idea into a guided investigation — verifying the claim, showing the real numbers, arguing the other side, and teaching concepts along the way.
              </p>
            </div>
          </div>
        </motion.section>


        {/* Final CTA */}
        <section className="text-center space-y-12 pb-32 w-full px-4">
          <h2 className="text-4xl sm:text-6xl md:text-8xl font-black tracking-tighter break-words">READY TO DIG IN?</h2>
          <Link href="/login" className="inline-block w-full sm:w-auto">
            <Button size="lg" className="w-full sm:w-auto h-auto py-4 md:py-0 md:h-20 px-6 md:px-16 text-lg sm:text-2xl font-black rounded-full shadow-[0_0_40px_rgba(var(--primary),0.3)] hover:shadow-[0_0_60px_rgba(var(--primary),0.5)] hover:scale-105 active:scale-95 transition-all duration-300 uppercase tracking-wider flex items-center justify-center whitespace-normal md:whitespace-nowrap">
              Start Building Intuition
              <ArrowRight className="ml-2 md:ml-4 w-6 h-6 md:w-8 md:h-8 flex-shrink-0" />
            </Button>
          </Link>
        </section>

      </div>
    </main>
  );
}

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

          <div className="grid lg:grid-cols-12 gap-8 lg:gap-16 items-center">
            {/* Left side text - constrained to 5 cols to keep it away from cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="space-y-10 relative z-10 lg:col-span-5"
            >
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-primary/10 text-primary font-bold tracking-wide uppercase text-sm border border-primary/20 backdrop-blur-md"
              >
                <span className="flex h-2.5 w-2.5 rounded-full bg-primary animate-pulse"></span>
                Meet THWIP
              </motion.div>
              
              <h1 className="text-6xl md:text-8xl lg:text-7xl xl:text-[6rem] font-black tracking-tighter text-foreground leading-[1.05]">
                THINK <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-500 via-purple-500 to-primary">
                  FUNDAMENTALLY.
                </span>
              </h1>
              
              <p className="text-xl md:text-2xl text-muted-foreground leading-relaxed font-medium">
                We don't tell you what to buy. We stress-test <span className="text-foreground underline decoration-primary decoration-4 underline-offset-4">why</span> you want to buy it — and show you every source we used.
              </p>
              
              <div className="pt-4 flex flex-col sm:flex-row items-center gap-6">
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

            {/* Over-the-top Floating UI Elements - Pushed to the right 7 cols */}
            <div className="relative h-[600px] hidden lg:block perspective-[2000px] lg:col-span-7">
              <motion.div
                initial={{ opacity: 0, rotateY: -15, x: 50, rotateZ: 2 }}
                animate={{ opacity: 1, rotateY: -10, x: 0, rotateZ: 5 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                className="absolute right-0 top-[5%] w-[450px] bg-card/80 backdrop-blur-2xl border border-border/50 rounded-3xl p-8 shadow-2xl hover:rotate-0 transition-transform duration-500"
              >
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                    <Search className="w-6 h-6 text-blue-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">Parsing Claim...</h3>
                    <p className="text-muted-foreground text-sm">"Government increased defense spending..."</p>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="h-4 bg-muted rounded-full w-full overflow-hidden relative">
                    <motion.div 
                      className="absolute top-0 left-0 h-full bg-blue-500"
                      initial={{ width: "0%" }}
                      animate={{ width: "100%" }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                  <div className="h-4 bg-muted rounded-full w-3/4" />
                  <div className="h-4 bg-muted rounded-full w-5/6" />
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, rotateY: -15, x: 100, y: 50, rotateZ: -5 }}
                animate={{ opacity: 1, rotateY: -5, x: -20, y: 220, rotateZ: -3 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.4 }}
                className="absolute right-[25%] top-[10%] w-[420px] bg-card/90 backdrop-blur-2xl border border-emerald-500/30 rounded-3xl p-6 shadow-[0_30px_60px_-15px_rgba(16,185,129,0.3)] z-10 hover:rotate-0 transition-transform duration-500"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="w-6 h-6 text-emerald-500" />
                    <span className="font-bold text-emerald-500">Verified Source</span>
                  </div>
                  <span className="text-xs font-bold px-2 py-1 rounded bg-emerald-500/20 text-emerald-600">GOVT</span>
                </div>
                <p className="text-lg font-medium leading-snug">
                  Ministry of Defence budget increased by 13% for FY24-25.
                </p>
              </motion.div>
              
              <motion.div
                initial={{ opacity: 0, rotateZ: -10, y: 150 }}
                animate={{ opacity: 1, rotateZ: -12, y: 350, x: 250 }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.6 }}
                className="absolute right-[40%] top-[-10%] w-[200px] h-[200px] bg-gradient-to-tr from-amber-500/20 to-orange-500/5 rounded-[2rem] border border-amber-500/20 backdrop-blur-xl flex flex-col items-center justify-center -z-10 shadow-xl"
              >
                <div className="text-4xl mb-2">🤔</div>
                <div className="font-bold text-amber-500">Wait, really?</div>
              </motion.div>
            </div>
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
              <div className="flex h-full items-center justify-between">
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

        {/* The Investigation Pipeline - Huge 6-Point Grid */}
        <section className="space-y-20">
          <div className="text-center space-y-6">
            <h2 className="text-5xl md:text-7xl font-black tracking-tighter">HOW IT WORKS</h2>
            <p className="text-2xl text-muted-foreground max-w-3xl mx-auto font-medium">Bring any thesis. We break it down and test it against reality.</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Search,
                color: "text-blue-500",
                bg: "bg-blue-500/10",
                border: "group-hover:border-blue-500/50",
                title: "1. Parse your claim",
                desc: "We break your reasoning down into the trigger event, the asset, the mechanism, and the time horizon."
              },
              {
                icon: ShieldCheck,
                color: "text-emerald-500",
                bg: "bg-emerald-500/10",
                border: "group-hover:border-emerald-500/50",
                title: "2. Verify with sources",
                desc: "No hallucinated numbers. We check government data, filings, and trusted press to see if your trigger is actually true."
              },
              {
                icon: Database,
                color: "text-purple-500",
                bg: "bg-purple-500/10",
                border: "group-hover:border-purple-500/50",
                title: "3. Raw fundamentals",
                desc: "Straight from the data pipeline. No AI interpretation here—just the core metrics and how they compare to the sector median."
              },
              {
                icon: Scale,
                color: "text-amber-500",
                bg: "bg-amber-500/10",
                border: "group-hover:border-amber-500/50",
                title: "4. Prove you wrong",
                desc: "Counter-evidence is our emotional beat. We always present the other side of the argument, forcing you to think critically."
              },
              {
                icon: BarChart2,
                color: "text-indigo-500",
                bg: "bg-indigo-500/10",
                border: "group-hover:border-indigo-500/50",
                title: "5. Compare peers",
                desc: "We contextualize your asset against the broader sector. You'll never fly blind without knowing how the competition is doing."
              },
              {
                icon: BookOpen,
                color: "text-rose-500",
                bg: "bg-rose-500/10",
                border: "group-hover:border-rose-500/50",
                title: "6. Where you stand",
                desc: "We summarize what holds up, what's weak, and what you should check next. We never give a score or a Buy/Sell rating."
              }
            ].map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`group relative bg-card p-10 rounded-3xl border border-border transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${step.border}`}
              >
                <div className={`w-20 h-20 rounded-2xl ${step.bg} flex items-center justify-center mb-8 transition-transform group-hover:scale-110 duration-300`}>
                  <step.icon className={`w-10 h-10 ${step.color}`} />
                </div>
                <h3 className="font-bold text-2xl mb-4">{step.title}</h3>
                <p className="text-lg text-muted-foreground leading-relaxed font-medium">
                  {step.desc}
                </p>
                <div className="absolute bottom-10 right-10 opacity-0 group-hover:opacity-100 transition-opacity translate-x-4 group-hover:translate-x-0 duration-300">
                  <ChevronRight className={`w-8 h-8 ${step.color}`} />
                </div>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="text-center space-y-12 pb-32">
          <h2 className="text-6xl md:text-8xl font-black tracking-tighter">READY TO DIG IN?</h2>
          <Link href="/login" className="inline-block">
            <Button size="lg" className="h-20 px-16 text-2xl font-black rounded-full shadow-[0_0_40px_rgba(var(--primary),0.3)] hover:shadow-[0_0_60px_rgba(var(--primary),0.5)] hover:scale-105 active:scale-95 transition-all duration-300 uppercase tracking-wider">
              Start Building Intuition
              <ArrowRight className="ml-4 w-8 h-8" />
            </Button>
          </Link>
        </section>

      </div>
    </main>
  );
}

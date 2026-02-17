"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Twitter, Github, Linkedin, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Pricing } from "@/components/blocks/pricing";
import { motion } from "framer-motion";

export default function LandingPage() {
  const [placedCount, setPlacedCount] = useState(87);
  const [avgCtc, setAvgCtc] = useState(9.2);
  const [isWindowFocused, setIsWindowFocused] = useState(false);

  const demoPlans = [
    {
      name: "STARTER",
      price: "50",
      yearlyPrice: "40",
      period: "per month",
      features: [
        "Up to 500 students",
        "Basic TPO Dashboard",
        "Job Posting System",
        "Standard Analytics",
        "Email Support",
      ],
      description: "Perfect for single departments or small colleges",
      buttonText: "Start Free Trial",
      href: "/signup",
      isPopular: false,
    },
    {
      name: "PROFESSIONAL",
      price: "99",
      yearlyPrice: "79",
      period: "per month",
      features: [
        "Up to 2000 students",
        "Advanced AI Resume Builder",
        "Automated Communication",
        "Priority TPO Support",
        "Student Performance Tracking",
        "Custom Branding",
      ],
      description: "Ideal for growing institutions and mid-size universities",
      buttonText: "Get Started",
      href: "/signup",
      isPopular: true,
    },
    {
      name: "ENTERPRISE",
      price: "299",
      yearlyPrice: "239",
      period: "per month",
      features: [
        "Unlimited students",
        "Custom Multi-campus Setup",
        "Dedicated Account Manager",
        "SSO & API Integration",
        "White-label Platform",
        "SLA Guarantee",
        "On-site Training",
      ],
      description: "For large universities with complex requirements",
      buttonText: "Contact Sales",
      href: "/contact",
      isPopular: false,
    },
  ];

  useEffect(() => {
    const interval = setInterval(() => {
      setPlacedCount(prev => prev >= 95 ? 80 : prev + 1);
    }, 150);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setAvgCtc(prev => {
        const next = parseFloat((prev + 0.1).toFixed(1));
        return next >= 12.0 ? 8.0 : next;
      });
    }, 100);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen w-full bg-white flex justify-center">
      <div className="flex w-full max-w-7xl border-x-2 border-black relative text-black bg-white font-sans antialiased overflow-x-hidden selection:bg-black selection:text-white">
        {/* Left Sidebar */}
        <div className="hidden lg:block w-[64px] border-r-2 border-black dot-matrix-pattern relative shrink-0"></div>

        {/* Main Content Column */}
        <div id="product" className="flex-1 flex flex-col relative technical-grid bg-white">
          {/* Background Overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage: "radial-gradient(circle, #000 1px, transparent 1px)",
              backgroundSize: "64px 64px",
              backgroundPosition: "-2px -2px",
            }}
          ></div>

          {/* Header */}
          <header className="w-full h-[80px] px-8 flex items-center justify-between relative z-20 bg-white border-y-2 border-black">
            <Link href="/" className="flex items-center gap-2 group hover-logo-3d">
              <img src="/logo.png" alt="PlacePro Logo" className="w-8 h-8 object-contain" />
              <span className="text-xl font-semibold tracking-tight text-neutral-900 transition-colors group-hover:text-blue-600">PlacePro</span>
            </Link>

            <nav className="hidden md:flex gap-8 text-[15px] font-medium text-neutral-600">
              {["Product", "Features", "Pricing", "Resources"].map((item) => (
                <Link
                  key={item}
                  className="relative group hover:text-black transition-colors"
                  href={`#${item.toLowerCase()}`}
                >
                  {item}
                  <span className="absolute left-0 -bottom-1 w-0 h-[2px] bg-blue-600 transition-all duration-300 group-hover:w-full"></span>
                </Link>
              ))}
            </nav>

            <div className="relative group">
              <Link href="/login">
                <button className="bg-black text-white px-6 py-2.5 text-sm font-medium relative hover:bg-blue-600 transition-colors shadow-sm active:translate-y-0.5">
                  Book a Demo
                  <div className="absolute top-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                  <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                  <div className="absolute bottom-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                  <div className="absolute bottom-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                </button>
              </Link>
            </div>
          </header>

          {/* Hero Content */}
          <main className="flex-1 flex flex-col items-center pt-10 pb-10 relative z-10 px-4">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: "easeOut" }}
              className="mb-6 bg-gray-100 px-4 py-1.5 rounded-sm text-xs font-medium text-gray-600 tracking-wide"
            >
              Placement Platform That Students Actually Love
            </motion.div>

            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
              className="font-serif text-4xl md:text-5xl lg:text-6xl text-center leading-[1.1] mb-6 max-w-4xl tracking-tight text-black"
            >
              Give Your Students a <span className="text-blue-600">Modern</span> <br />
              <span className="italic font-light">Job Application Experience</span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
              className="text-center text-gray-600 max-w-xl text-sm leading-relaxed mb-6 font-light"
            >
              PlacePro isn't just admin software—students get a beautiful dashboard, AI resume builder, and real-time application tracking. Result? 3x higher engagement than traditional systems.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
              className="flex gap-4 mb-8 relative"
            >
              <Link href="/signup">
                <button className="bg-black text-white px-8 py-3 text-sm font-medium relative hover:bg-blue-600 transition-colors">
                  Book a Strategy Demo
                  <div className="absolute top-1.5 left-1.5 w-1 h-1 bg-white rounded-full"></div>
                  <div className="absolute top-1.5 right-1.5 w-1 h-1 bg-white rounded-full"></div>
                  <div className="absolute bottom-1.5 left-1.5 w-1 h-1 bg-white rounded-full"></div>
                  <div className="absolute bottom-1.5 right-1.5 w-1 h-1 bg-white rounded-full"></div>
                </button>
              </Link>
              <button className="bg-[#E5E5E5] text-black px-8 py-3 text-sm font-medium hover:bg-[#d4d4d4] transition-colors relative">
                View 5-Minute Product Tour
                <div className="absolute top-1.5 left-1.5 w-1 h-1 bg-black rounded-full"></div>
                <div className="absolute top-1.5 right-1.5 w-1 h-1 bg-black rounded-full"></div>
                <div className="absolute bottom-1.5 left-1.5 w-1 h-1 bg-black rounded-full"></div>
                <div className="absolute bottom-1.5 right-1.5 w-1 h-1 bg-black rounded-full"></div>
              </button>
            </motion.div>


            <motion.div
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1, delay: 0.5 }}
              className="relative w-full max-w-[1200px] h-[500px] hidden md:block mx-auto mt-6"
            >
              {/* Connection Lines */}
              <div className="relative w-[1000px] h-full mx-auto">
                <svg
                  className="absolute inset-0 w-full h-full pointer-events-none z-0"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <defs>
                    <marker
                      id="dot-start"
                      markerWidth="8"
                      markerHeight="8"
                      refX="4"
                      refY="4"
                    >
                      <circle cx="4" cy="4" r="2" fill="black" />
                    </marker>
                    <marker
                      id="dot-end"
                      markerWidth="8"
                      markerHeight="8"
                      refX="4"
                      refY="4"
                    >
                      <circle cx="4" cy="4" r="2" fill="black" />
                    </marker>
                  </defs>

                  {/* Permanent Gray Skeleton Lines */}
                  {[
                    "M 230 70 L 320 70 L 400 250", "M 230 160 L 300 160 L 400 250",
                    "M 230 250 L 400 250", "M 230 340 L 300 340 L 400 250",
                    "M 230 430 L 320 430 L 400 250", "M 500 250 L 550 250",
                    "M 710 160 L 820 250", "M 710 250 L 820 250",
                    "M 710 340 L 820 250", "M 820 250 L 850 250"
                  ].map((d, i) => (
                    <motion.path
                      key={`gray-${i}`}
                      d={d}
                      fill="none"
                      stroke="#d4d4d4"
                      strokeWidth="1.5"
                      initial={{ pathLength: 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 1.2 + i * 0.02, ease: "easeInOut" }}
                    />
                  ))}

                  {/* Premium Blue Data Flow (Pulsing Signals) */}
                  {[
                    "M 230 70 L 320 70 L 400 250", "M 230 160 L 300 160 L 400 250",
                    "M 230 250 L 400 250", "M 230 340 L 300 340 L 400 250",
                    "M 230 430 L 320 430 L 400 250", "M 500 250 L 550 250",
                    "M 710 160 L 820 250", "M 710 250 L 820 250",
                    "M 710 340 L 820 250", "M 820 250 L 850 250"
                  ].map((d, i) => (
                    <motion.path
                      key={`blue-${i}`}
                      d={d}
                      fill="none"
                      stroke="#2563eb"
                      strokeWidth="1.5"
                      className="animate-premium-dash-blue"
                      initial={{ opacity: 0 }}
                      whileInView={{ opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.5, delay: 2.2 + i * 0.05 }}
                    />
                  ))}
                </svg>

                {/* Left Column Nodes */}
                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1, delayChildren: 0.2 }
                    }
                  }}
                  className="absolute left-[50px] top-[50px] flex flex-col gap-[50px]"
                >
                  {[
                    { icon: "folder_open", label: "Student Records" },
                    { icon: "description", label: "Resume Data" },
                    { icon: "school", label: "Academic History" },
                    { icon: "business_center", label: "Internships" },
                    { icon: "grid_view", label: "Skill Matrix" }
                  ].map((node, i) => (
                    <motion.div
                      key={node.label}
                      variants={{
                        hidden: { opacity: 0, x: -20 },
                        show: { opacity: 1, x: 0 }
                      }}
                      whileHover={{ scale: 1.05, borderColor: "#2563eb" }}
                      className="w-[180px] h-[40px] bg-white border-2 border-black p-1 relative z-10 transition-colors"
                    >
                      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                      <div className="w-full h-full border border-dashed border-black flex items-center px-3 gap-3">
                        <span className="material-symbols-outlined text-[18px]">{node.icon}</span>
                        <span className="text-xs font-semibold">{node.label}</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Center Node */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.6, delay: 0.5 }}
                  whileHover={{ scale: 1.05 }}
                  className="absolute left-[400px] top-[200px] w-[100px] h-[100px] bg-white border-2 border-black p-1 flex items-center justify-center z-10"
                >
                  <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                  <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>

                  {/* Processing Animation Container */}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden z-20">
                    {/* Incoming Data (Left to Center) */}
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={`in-${i}`}
                        className="absolute w-2 h-[2px] bg-blue-600 animate-data-input"
                        style={{
                          left: '10px',
                          top: `${25 + i * 12}px`,
                          animationDelay: `${i * 0.2}s`,
                        }}
                      />
                    ))}

                    {/* Outgoing Solutions (Center to Right) */}
                    {[...Array(5)].map((_, i) => (
                      <div
                        key={`out-${i}`}
                        className="absolute w-3 h-[2px] bg-blue-600 animate-data-output"
                        style={{
                          right: '10px',
                          top: `${25 + i * 12}px`,
                          animationDelay: `${i * 0.2 + 0.5}s`,
                        }}
                      />
                    ))}
                  </div>

                  <div className="w-full h-full border border-dashed border-black flex items-center justify-center relative z-10">
                    <img
                      src="/logo.png"
                      alt="PlacePro Engine"
                      className="w-12 h-12 object-contain animate-engine-rotate"
                    />
                  </div>
                </motion.div>

                {/* Right Column Nodes */}
                <motion.div
                  initial="hidden"
                  whileInView="show"
                  viewport={{ once: true }}
                  variants={{
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1, delayChildren: 0.8 }
                    }
                  }}
                  className="absolute left-[550px] top-[140px] flex flex-col gap-[50px]"
                >
                  {[
                    "01. Top Candidate",
                    "02. Shortlisted",
                    "03. Qualified"
                  ].map((label, i) => (
                    <motion.div
                      key={label}
                      variants={{
                        hidden: { opacity: 0, x: 20 },
                        show: { opacity: 1, x: 0 }
                      }}
                      whileHover={{ scale: 1.05, borderColor: "#2563eb" }}
                      className="w-[160px] h-[40px] bg-white border-2 border-black p-1 relative z-10 transition-colors"
                    >
                      <div className="absolute -right-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                      <div className="w-full h-full border border-dashed border-black flex items-center px-3 z-10">
                        <span className="text-xs font-semibold">{label}</span>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>

                {/* Final Node */}
                <motion.div
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8, delay: 1.2 }}
                  className="absolute left-[850px] top-[180px] flex flex-col items-center z-10"
                >
                  <span className="text-[10px] font-bold uppercase tracking-widest mb-3 text-neutral-500">
                    FINAL RESULT
                  </span>
                  <motion.div
                    whileHover={{ scale: 1.02, boxShadow: "0 20px 40px rgba(37,99,235,0.1)" }}
                    className="min-w-[200px] border-2 border-black bg-white p-1 relative z-10 transition-all"
                  >
                    <div className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-2.5 h-2.5 bg-black rounded-full"></div>
                    <div className="w-full h-full border border-dashed border-black flex flex-col justify-center px-4 py-3 gap-2">
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="font-medium text-gray-600">Placed Students</span>
                        <span className="font-bold tabular-nums">~{placedCount}%</span>
                      </div>
                      <div className="flex justify-between items-center text-xs gap-4">
                        <span className="font-medium text-gray-600">Avg CTC</span>
                        <span className="font-bold tabular-nums">~₹{avgCtc} LPA</span>
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              </div>
            </motion.div>

            <div className="md:hidden w-full h-[300px] border border-dashed border-gray-300 flex items-center justify-center bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500 text-center px-4">
                Technical Architecture Diagram Viewable on Desktop
              </p>
            </div>
          </main>

          <div className="w-full h-0.5 bg-black"></div>

          {/* Trusted By Institutions */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="py-12 bg-white border-b-2 border-black"
          >
            <div className="max-w-[1200px] mx-auto px-8">
              <p className="text-center text-xs font-space-mono font-bold text-gray-500 mb-8 uppercase tracking-widest">
                TRUSTED BY INSTITUTIONS
              </p>
              <div className="flex flex-wrap justify-center gap-x-16 gap-y-8 opacity-100">
                {[
                  { icon: "school", name: "IIT Bombay" },
                  { icon: "menu_book", name: "BITS Pilani" },
                  { icon: "history_edu", name: "NIT Trichy" },
                  { icon: "science", name: "IIIT Hyderabad" },
                  { icon: "architecture", name: "VIT Vellore" }
                ].map((inst, i) => (
                  <motion.div
                    key={inst.name}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: i * 0.1 }}
                    className="flex items-center gap-2 font-black text-xl text-black hover:text-blue-600 transition-colors cursor-pointer"
                  >
                    <span className="material-symbols-outlined">{inst.icon}</span> {inst.name}
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.section>

          {/* Unified Platform */}
          <motion.section
            id="features"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="py-32 px-8 bg-[#FAFAFA] border-b-2 border-black bg-grid-paper"
            style={{ backgroundSize: "24px 24px" }}
          >
            <div className="max-w-[1200px] mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="max-w-[1200px] mx-auto text-center mb-16"
              >
                <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-black mb-6">
                  Unified Platform <br />
                  <span className="italic font-light">Full Stack Application Suite</span>
                </h2>
                <p className="text-gray-600 max-w-2xl mx-auto text-sm leading-relaxed font-light">
                  Everything required to build placement drives and manage student
                  lifecycles on a single, high-fidelity platform.
                </p>
              </motion.div>
              <div className="space-y-12">
                {/* Premium Student Dashboard Mockup */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 40 }}
                  whileInView={{ opacity: 1, scale: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, ease: "easeOut" }}
                  className="relative mx-auto max-w-[1000px] perspective-1000"
                >
                  {/* Browser Window Frame - Chrome Style */}
                  <div className="bg-white rounded-xl border-2 border-black overflow-hidden shadow-2xl relative z-10 transition-transform hover:scale-[1.002] duration-500">

                    {/* Browser Chrome (Header) */}
                    <div className="bg-[#dfe1e5] border-b border-[#bdc1c6]">
                      {/* Tab Strip */}
                      <div className="flex items-end px-3 pt-2 gap-2 h-10 select-none">
                        {/* MacOS Window Controls */}
                        <div className="flex gap-2 mr-4 mb-2.5">
                          <div className="w-3 h-3 rounded-full bg-[#ff5f57] border border-[#e0443e] shadow-sm"></div>
                          <div className="w-3 h-3 rounded-full bg-[#ffbd2e] border border-[#dea123] shadow-sm"></div>
                          <div className="w-3 h-3 rounded-full bg-[#27c93f] border border-[#1aab29] shadow-sm"></div>
                        </div>

                        {/* Active Tab */}
                        <div className="bg-white py-2 px-4 rounded-t-lg text-xs font-medium text-[#3c4043] relative -mb-[1px] flex items-center gap-2 min-w-[200px] shadow-[0_-1px_2px_rgba(0,0,0,0.05)] before:absolute before:bottom-0 before:-left-2 before:w-2 before:h-2 before:bg-transparent before:shadow-[2px_2px_0_#fff] before:rounded-br-full after:absolute after:bottom-0 after:-right-2 after:w-2 after:h-2 after:bg-transparent after:shadow-[-2px_2px_0_#fff] after:rounded-bl-full z-10">
                          <img src="/logo.png" className="w-3 h-3 object-contain opacity-80" alt="" />
                          PlacePro Student Portal
                          <span className="material-symbols-outlined text-[14px] ml-auto text-neutral-400 hover:bg-neutral-200 rounded-full p-0.5 transition-colors">close</span>
                        </div>

                        {/* Inactive Tab */}
                        <div className="py-2 px-3 text-xs font-medium text-[#5f6368] hover:bg-[#ebedef] rounded-t-lg transition-colors flex items-center gap-2 mb-0.5 cursor-pointer">
                          New Tab
                        </div>

                        {/* Add Tab Button */}
                        <div className="text-[#5f6368] hover:bg-[#ebedef] rounded-full cursor-pointer transition-colors mb-1 ml-1 w-8 h-8 flex items-center justify-center">
                          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="5" x2="12" y2="19"></line>
                            <line x1="5" y1="12" x2="19" y2="12"></line>
                          </svg>
                        </div>
                      </div>

                      {/* Navigation & Address Bar */}
                      <div className="bg-white py-2 px-4 border-t border-[#bdc1c6] flex items-center gap-3 shadow-sm relative z-20">
                        <div className="flex gap-4 text-[#5f6368]">
                          <span className="material-symbols-outlined text-[18px] cursor-pointer hover:bg-neutral-100 rounded-full p-1 -m-1 transition-colors">arrow_back</span>
                          <span className="material-symbols-outlined text-[18px] cursor-pointer hover:bg-neutral-100 rounded-full p-1 -m-1 transition-colors opacity-50">arrow_forward</span>
                          <span className="material-symbols-outlined text-[18px] cursor-pointer hover:bg-neutral-100 rounded-full p-1 -m-1 transition-colors">refresh</span>
                        </div>

                        {/* Address Bar Input */}
                        <div className="flex-1 bg-[#f1f3f4] hover:bg-[#e8eaed] transition-colors rounded-full px-4 py-1.5 text-xs text-[#202124] flex items-center justify-center gap-2 group cursor-text border border-transparent focus-within:bg-white focus-within:border-[#1a73e8] focus-within:shadow-[0_1px_6px_rgba(32,33,36,0.28)]">
                          <span className="material-symbols-outlined text-[14px] text-[#5f6368] group-focus-within:hidden">lock</span>
                          <span className="text-[#5f6368] group-focus-within:text-black">https://</span>
                          <span className="font-medium text-[#202124]">placepro.in</span>
                          <span className="text-[#5f6368]">/student/dashboard</span>
                        </div>

                        <div className="flex gap-3 text-[#5f6368]">
                          <span className="material-symbols-outlined text-[18px] cursor-pointer hover:bg-neutral-100 rounded-full p-1 -m-1 transition-colors">star_border</span>
                          <div className="w-px h-5 bg-[#bdc1c6] mx-1"></div>
                          <span className="material-symbols-outlined text-[18px] cursor-pointer hover:bg-neutral-100 rounded-full p-1 -m-1 transition-colors">account_circle</span>
                          <span className="material-symbols-outlined text-[18px] cursor-pointer hover:bg-neutral-100 rounded-full p-1 -m-1 transition-colors">more_vert</span>
                        </div>
                      </div>
                    </div>

                    {/* Viewport Content Area */}
                    <div
                      className="flex flex-col w-full h-[600px] bg-white relative text-left overflow-hidden group"
                      onClick={() => setIsWindowFocused(true)}
                      onMouseLeave={() => setIsWindowFocused(false)}
                    >
                      <div className="flex flex-1 overflow-hidden" style={{ maxWidth: 'calc(100% - 128px)', margin: '0 auto', background: '#fff', borderLeft: '2px solid #000', borderRight: '2px solid #000', position: 'relative', display: 'flex', flexDirection: 'column', height: '100%' }}>
                        <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b-2 border-black h-14 flex items-center justify-between px-4 shrink-0">
                          <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                              <span className="material-symbols-outlined text-xl">school</span>
                              <span className="text-base font-bold tracking-tight">PlacePro <span className="text-blue-600 font-medium ml-1">Student</span></span>
                            </div>
                            <div className="h-5 w-px bg-neutral-200 mx-2"></div>
                            <div className="text-xs font-medium text-neutral-500">Computer Science • 2024</div>
                          </div>
                          <div className="flex-1 max-w-lg mx-6">
                            <div className="relative group">
                              <span className="material-symbols-outlined text-[18px] absolute left-3 top-2 text-neutral-400 group-hover:text-neutral-600 transition-colors">search</span>
                              <input className="w-full bg-neutral-50 border border-neutral-200 rounded-lg py-1.5 pl-9 pr-12 text-xs focus:outline-none focus:border-black focus:ring-0 transition-all placeholder:text-neutral-400" placeholder="Search jobs, skills, or resources..." type="text" />
                              <div className="absolute right-3 top-2 flex items-center gap-1">
                                <kbd className="hidden sm:inline-block border border-neutral-200 rounded px-1.5 text-[9px] font-bold text-neutral-400 bg-white">Ctrl</kbd>
                                <kbd className="hidden sm:inline-block border border-neutral-200 rounded px-1.5 text-[9px] font-bold text-neutral-400 bg-white">K</kbd>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <button className="relative p-1.5 hover:bg-neutral-50 rounded-full transition-colors text-neutral-500 hover:text-black">
                              <span className="material-symbols-outlined text-[20px]">notifications</span>
                              <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-blue-500 rounded-full border border-white"></span>
                            </button>
                            <div className="flex items-center gap-2.5 pl-4 border-l border-neutral-200">
                              <div className="text-right hidden sm:block">
                                <div className="text-xs font-semibold">Arjun Verma</div>
                                <div className="text-[10px] text-neutral-500">Looking for SDE Roles</div>
                              </div>
                              <div className="w-8 h-8 bg-neutral-100 rounded border border-neutral-200 overflow-hidden shadow-sm">
                                <img alt="Profile" className="w-full h-full object-cover" src="https://lh3.googleusercontent.com/aida-public/AB6AXuBuV20ocktuWldNth-yM9LJQdPONxjzsiCYEBLeGRAfJf0iISKTJOWyBEGv-I6INFmmVqfyBzwQMwc3OQKT5YyTNewHYasZqo_3Izfz1Yc9SP9bWc3O2LPMKU_tmBSwjfVnCoXWypj9s36J9p09paEMT9ow9cKLZFitQVfn2gXXbP5fbKCjhOn0-EaCh8JUzcveor0O3G_aCjrLrJq_8-RPZ4oUTTfUDP461Oc6jyYvy1kG5zEy82dwZLYbDtD9bYi5h8ZOadayxl9G" />
                              </div>
                            </div>
                          </div>
                        </header>


                        <div className="flex flex-1 overflow-hidden bg-white">
                          <aside className={`w-48 border-r-2 border-black flex flex-col bg-white hidden md:flex shrink-0 h-full ${isWindowFocused ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                            <nav className="flex-1 p-3 space-y-1">
                              <a className="flex items-center gap-2.5 px-3 py-2 bg-black text-white rounded text-xs font-medium shadow-sm transition-transform active:scale-95" href="#">
                                <span className="material-symbols-outlined text-[18px]">dashboard</span>
                                Dashboard
                              </a>
                              <a className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 hover:bg-neutral-50 hover:text-black rounded text-xs font-medium transition-colors" href="#">
                                <span className="material-symbols-outlined text-[18px]">work</span>
                                Job Board
                              </a>
                              <a className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 hover:bg-neutral-50 hover:text-black rounded text-xs font-medium transition-colors" href="#">
                                <span className="material-symbols-outlined text-[18px]">assignment_turned_in</span>
                                My Applications
                                <span className="ml-auto bg-blue-50 text-blue-600 py-0.5 px-1.5 rounded-[4px] text-[10px] font-bold">12</span>
                              </a>
                              <a className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 hover:bg-neutral-50 hover:text-black rounded text-xs font-medium transition-colors" href="#">
                                <span className="material-symbols-outlined text-[18px]">description</span>
                                Resume Builder
                              </a>
                              <a className="flex items-center gap-2.5 px-3 py-2 text-neutral-600 hover:bg-neutral-50 hover:text-black rounded text-xs font-medium transition-colors" href="#">
                                <span className="material-symbols-outlined text-[18px]">library_books</span>
                                Resources
                              </a>
                            </nav>
                            <div className="p-3 border-t border-neutral-200 mt-auto">
                              <div className="bg-neutral-50 rounded p-2.5 border border-neutral-200">
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="material-symbols-outlined text-neutral-500 text-[10px]">tips_and_updates</span>
                                  <span className="text-[9px] font-bold text-neutral-700">Interview Tip</span>
                                </div>
                                <p className="text-[9px] text-neutral-500 leading-relaxed mb-1.5">Practice STAR method for behavioral questions.</p>
                              </div>
                              <div className="mt-2.5 flex items-center justify-between px-1 text-[9px] text-neutral-500">
                                <span>Student Portal v2.4</span>
                                <a className="hover:underline" href="#">Settings</a>
                              </div>
                            </div>
                          </aside>

                          <main className={`flex-1 bg-neutral-50/30 p-5 ${isWindowFocused ? 'overflow-y-auto' : 'overflow-hidden'}`}>
                            <div className="max-w-6xl mx-auto space-y-6">
                              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                                <div className="lg:col-span-2 rounded-xl border-2 border-black overflow-hidden bg-gradient-to-br from-[#2563eb] to-[#1e40af] text-white relative group">
                                  <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl"></div>
                                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-black/10 rounded-full translate-y-1/2 -translate-x-1/2 blur-2xl"></div>
                                  <div className="relative p-6 h-full flex flex-col justify-between z-10">
                                    <div>
                                      <h1 className="text-2xl font-bold mb-1.5">Welcome back, Arjun</h1>
                                      <p className="text-blue-100 text-xs max-w-md leading-relaxed">You have 2 upcoming interviews this week. Keep up the momentum, your profile is looking strong!</p>
                                    </div>
                                    <div className="flex items-center gap-3 mt-4">
                                      <button className="bg-white text-blue-700 px-3 py-1.5 rounded text-xs font-bold hover:bg-blue-50 transition-colors shadow-sm">View Schedule</button>
                                      <button className="bg-transparent border border-white/30 text-white px-3 py-1.5 rounded text-xs font-bold hover:bg-white/10 transition-colors">Update Profile</button>
                                    </div>
                                  </div>
                                </div>
                                <div className="bg-white rounded-xl border-2 border-black p-5 flex flex-col items-center justify-center relative overflow-hidden">
                                  <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider absolute top-4 left-4">Placement Readiness</h3>
                                  <div className="relative w-24 h-24 mt-2">
                                    <svg className="transform -rotate-90 w-24 h-24">
                                      <circle cx="48" cy="48" fill="transparent" r="42" stroke="#f0f0f0" strokeWidth="6"></circle>
                                      <circle className="transition-all duration-1000 ease-out text-blue-600" cx="48" cy="48" fill="transparent" r="42" stroke="currentColor" strokeDasharray="263.8" strokeDashoffset="47" strokeLinecap="round" strokeWidth="6"></circle>
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                                      <span className="text-2xl font-bold tracking-tight">82%</span>
                                      <span className="text-[9px] text-neutral-400 font-medium uppercase">Strong</span>
                                    </div>
                                  </div>
                                  <p className="text-[10px] text-neutral-500 mt-3 text-center px-2">Complete 2 mock tests to reach 90% readiness score.</p>
                                </div>
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="bg-white p-4 rounded-lg border-2 border-black group hover:bg-neutral-50/50 transition-colors">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">Applications Sent</h3>
                                      <div className="text-2xl font-bold mt-0.5 tracking-tight">12</div>
                                    </div>
                                    <div className="p-1.5 bg-neutral-100 rounded text-neutral-600">
                                      <span className="material-symbols-outlined text-lg">send</span>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-medium flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                                    3 Active processes
                                  </div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-black group hover:bg-neutral-50/50 transition-colors">
                                  <div className="flex justify-between items-start mb-3">
                                    <div>
                                      <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">Shortlisted</h3>
                                      <div className="text-2xl font-bold mt-0.5 tracking-tight">4</div>
                                    </div>
                                    <div className="p-1.5 bg-blue-50 rounded text-blue-600">
                                      <span className="material-symbols-outlined text-lg">check_circle</span>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-neutral-500 font-medium">Avg. response time: 2 days</div>
                                </div>
                                <div className="bg-white p-4 rounded-lg border-2 border-black group hover:bg-neutral-50/50 transition-colors relative overflow-hidden">
                                  <div className="flex justify-between items-start mb-2">
                                    <div>
                                      <h3 className="text-neutral-500 text-[10px] font-bold uppercase tracking-wider">Upcoming Interviews</h3>
                                      <div className="text-2xl font-bold mt-0.5 tracking-tight">2</div>
                                    </div>
                                    <div className="p-1.5 bg-orange-50 rounded text-orange-600 animate-pulse">
                                      <span className="material-symbols-outlined text-lg">timer</span>
                                    </div>
                                  </div>
                                  <div className="mt-2 p-1.5 bg-neutral-50 rounded border border-neutral-100 flex items-center justify-between">
                                    <span className="text-[10px] font-semibold">Uber R2</span>
                                    <span className="text-[10px] font-mono text-orange-600">23h 14m</span>
                                  </div>
                                </div>
                              </div>

                              <div className="flex flex-col lg:flex-row gap-6">
                                <div className="flex-1 space-y-4">
                                  <div className="flex items-center justify-between">
                                    <h2 className="text-base font-bold">Recommended for You</h2>
                                    <div className="flex gap-2">
                                      <button className="text-[10px] font-medium text-neutral-500 hover:text-black transition-colors px-2 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">Filter</button>
                                      <button className="text-[10px] font-medium text-neutral-500 hover:text-black transition-colors px-2 py-1 bg-white border border-neutral-200 rounded hover:bg-neutral-50">Sort</button>
                                    </div>
                                  </div>

                                  <div className="bg-white p-4 rounded-lg border-2 border-black group">
                                    <div className="flex justify-between items-start">
                                      <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-neutral-50 border border-neutral-100 flex items-center justify-center">
                                          <div className="font-bold text-lg text-neutral-800">G</div>
                                        </div>
                                        <div>
                                          <h3 className="font-bold text-sm">Software Engineer, Early Career</h3>
                                          <p className="text-[10px] text-neutral-500 font-medium">Google • Bangalore • On-site</p>
                                          <div className="flex gap-1.5 mt-2">
                                            <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 text-[9px] font-bold uppercase rounded tracking-wide">Full Time</span>
                                            <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 text-[9px] font-bold uppercase rounded tracking-wide">₹28-42 LPA</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-bold border border-green-100">
                                          <span className="material-symbols-outlined text-[12px]">stars</span>
                                          98% Match
                                        </div>
                                        <span className="text-[9px] text-neutral-400">Posted 2h ago</span>
                                      </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-between items-center">
                                      <div className="flex -space-x-1.5">
                                        <span className="text-[10px] text-neutral-500 mr-2 self-center">Skills:</span>
                                        <div className="w-5 h-5 rounded-full bg-neutral-100 border border-white flex items-center justify-center text-[7px] font-bold text-neutral-600">JS</div>
                                        <div className="w-5 h-5 rounded-full bg-neutral-100 border border-white flex items-center justify-center text-[7px] font-bold text-neutral-600">Py</div>
                                        <div className="w-5 h-5 rounded-full bg-neutral-100 border border-white flex items-center justify-center text-[7px] font-bold text-neutral-600">Go</div>
                                      </div>
                                      <button className="bg-black text-white px-4 py-1.5 rounded text-[10px] font-semibold hover:bg-neutral-800 transition-colors">Apply Now</button>
                                    </div>
                                  </div>

                                  <div className="bg-white p-4 rounded-lg border-2 border-black group">
                                    <div className="flex justify-between items-start">
                                      <div className="flex gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-black text-white flex items-center justify-center">
                                          <div className="font-bold text-lg">U</div>
                                        </div>
                                        <div>
                                          <h3 className="font-bold text-sm">Backend Developer SDE-I</h3>
                                          <p className="text-[10px] text-neutral-500 font-medium">Uber • Hyderabad • Hybrid</p>
                                          <div className="flex gap-1.5 mt-2">
                                            <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 text-[9px] font-bold uppercase rounded tracking-wide">Full Time</span>
                                            <span className="px-1.5 py-0.5 bg-neutral-100 text-neutral-600 text-[9px] font-bold uppercase rounded tracking-wide">₹32 LPA</span>
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex flex-col items-end gap-1.5">
                                        <div className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-700 rounded text-[10px] font-bold border border-green-100">
                                          <span className="material-symbols-outlined text-[12px]">stars</span>
                                          94% Match
                                        </div>
                                        <span className="text-[9px] text-neutral-400">Posted 5h ago</span>
                                      </div>
                                    </div>
                                    <div className="mt-4 pt-3 border-t border-neutral-100 flex justify-between items-center">
                                      <div className="flex -space-x-1.5">
                                        <span className="text-[10px] text-neutral-500 mr-2 self-center">Skills:</span>
                                        <div className="w-5 h-5 rounded-full bg-neutral-100 border border-white flex items-center justify-center text-[7px] font-bold text-neutral-600">Ja</div>
                                        <div className="w-5 h-5 rounded-full bg-neutral-100 border border-white flex items-center justify-center text-[7px] font-bold text-neutral-600">SQL</div>
                                      </div>
                                      <button className="bg-white border border-black text-black px-4 py-1.5 rounded text-[10px] font-semibold hover:bg-neutral-50 transition-colors">View Details</button>
                                    </div>
                                  </div>
                                </div>

                                <div className="w-full lg:w-72 space-y-4">
                                  <div className="bg-white p-4 rounded-lg border-2 border-black h-full shadow-sm">
                                    <h3 className="font-bold text-sm mb-4">Interview Roadmap</h3>
                                    <div className="relative pl-4 border-l-2 border-neutral-100 space-y-6">
                                      <div className="relative">
                                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white ring-1 ring-neutral-200"></div>
                                        <div className="mb-0.5">
                                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Completed</span>
                                        </div>
                                        <h4 className="text-xs font-bold">Uber Online Assessment</h4>
                                        <p className="text-[10px] text-neutral-500 mt-0.5">Score: 92/100 • Oct 12, 2024</p>
                                      </div>
                                      <div className="relative">
                                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white ring-1 ring-neutral-200"></div>
                                        <div className="mb-0.5">
                                          <span className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Completed</span>
                                        </div>
                                        <h4 className="text-xs font-bold">Uber Technical R1</h4>
                                        <p className="text-[10px] text-neutral-500 mt-0.5">Feedback: Strong DSA skills • Oct 15, 2024</p>
                                      </div>
                                      <div className="relative">
                                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-blue-600 border-2 border-white ring-4 ring-blue-50"></div>
                                        <div className="mb-0.5">
                                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wide flex items-center gap-1">
                                            <span className="w-1 h-1 bg-blue-600 rounded-full animate-pulse"></span>
                                            Up Next
                                          </span>
                                        </div>
                                        <h4 className="text-xs font-bold text-black">Uber System Design R2</h4>
                                        <div className="mt-2 bg-blue-50 p-2.5 rounded border border-blue-100">
                                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-800 mb-0.5">
                                            <span className="material-symbols-outlined text-xs">event</span>
                                            Tomorrow
                                          </div>
                                          <div className="flex items-center gap-1.5 text-[10px] font-medium text-blue-800">
                                            <span className="material-symbols-outlined text-xs">schedule</span>
                                            2:00 PM - 3:00 PM
                                          </div>
                                        </div>
                                        <div className="mt-2 flex gap-2">
                                          <button className="w-full text-[10px] py-1 border border-neutral-300 rounded font-medium hover:bg-neutral-50">Prep Material</button>
                                          <button className="w-full text-[10px] py-1 bg-black text-white rounded font-medium hover:bg-neutral-800">Join Link</button>
                                        </div>
                                      </div>
                                      <div className="relative opacity-50">
                                        <div className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-neutral-300 border-2 border-white"></div>
                                        <div className="mb-0.5">
                                          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wide">Future</span>
                                        </div>
                                        <h4 className="text-xs font-bold">HR Discussion</h4>
                                        <p className="text-[10px] text-neutral-500 mt-0.5">Pending Clearance</p>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </main>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* Real-time Intelligence - Moved down as requested */}
                <motion.div
                  initial={{ opacity: 0, y: 40 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.8 }}
                  className="bg-white border-2 border-black shadow-sharp p-0 overflow-hidden"
                >
                  <div className="grid md:grid-cols-2">
                    <div className="p-10 flex flex-col justify-center border-r-2 border-black">
                      <h3 className="text-2xl font-bold text-black mb-4 tracking-tight">
                        Real-time Intelligence
                      </h3>
                      <p className="text-gray-600 leading-relaxed mb-8">
                        Visualize placement trends across departments. Export
                        reports for NBA/NAAC accreditation in one click.
                      </p>
                      <motion.ul
                        variants={{
                          hidden: { opacity: 0 },
                          show: {
                            opacity: 1,
                            transition: { staggerChildren: 0.1 }
                          }
                        }}
                        initial="hidden"
                        whileInView="show"
                        viewport={{ once: true }}
                        className="space-y-4"
                      >
                        {[
                          "Department-wise breakdown",
                          "Salary range distribution",
                          "Recruiter feedback loops"
                        ].map((text, i) => (
                          <motion.li
                            key={i}
                            variants={{
                              hidden: { opacity: 0, x: -10 },
                              show: { opacity: 1, x: 0 }
                            }}
                            className="flex items-center gap-3 text-sm font-bold text-black font-space-mono"
                          >
                            <div className="w-5 h-5 bg-blue-600 border border-black flex items-center justify-center text-white text-xs text-[10px]">
                              ✓
                            </div>
                            {text}
                          </motion.li>
                        ))}
                      </motion.ul>
                    </div>
                    <div className="bg-gray-50 p-10 flex items-center justify-center relative">
                      <div className="relative w-full max-w-md bg-white border-2 border-black shadow-sharp p-6 z-10">
                        <div className="text-xs font-bold text-black uppercase mb-6 font-space-mono border-b border-gray-200 pb-2">
                          Placement Performance // Q3
                        </div>
                        <div className="flex items-end gap-3 h-40">
                          {[
                            { h: "40%", c: "bg-gray-200" },
                            { h: "60%", c: "bg-gray-300" },
                            { h: "50%", c: "bg-gray-400" },
                            { h: "80%", c: "bg-gray-800" },
                            { h: "95%", c: "bg-blue-600 border-2 shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]" }
                          ].map((bar, i) => (
                            <motion.div
                              key={i}
                              initial={{ height: 0 }}
                              whileInView={{ height: bar.h }}
                              viewport={{ once: true }}
                              transition={{ duration: 1, delay: 0.5 + i * 0.1, ease: "easeOut" }}
                              className={`w-full ${bar.c} border border-black`}
                            />
                          ))}
                        </div>
                        <div className="flex justify-between mt-4 text-[10px] text-gray-500 font-space-mono font-bold">
                          <span>JAN</span>
                          <span>FEB</span>
                          <span>MAR</span>
                          <span>APR</span>
                          <span>MAY</span>
                        </div>
                      </div>
                      <div
                        className="absolute inset-0 opacity-10"
                        style={{
                          backgroundImage:
                            "linear-gradient(0deg, #000 1px, transparent 1px), linear-gradient(90deg, #000 1px, transparent 1px)",
                          backgroundSize: "20px 20px",
                        }}
                      ></div>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </motion.section>

          {/* Why PlacePro? */}
          <motion.section
            id="resources"
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="py-32 px-8 bg-white border-b-2 border-black"
          >
            <div className="max-w-[1000px] mx-auto">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8 }}
                className="text-center mb-16"
              >
                <h2 className="font-serif text-3xl md:text-4xl lg:text-5xl text-black mb-4">
                  Why <span className="italic">PlacePro?</span>
                </h2>
                <p className="text-gray-600 text-sm font-light uppercase tracking-widest">
                  A superior standard for academic operations.
                </p>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.2 }}
                className="overflow-x-auto border-2 border-black"
              >
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-black text-white">
                      <th className="py-6 px-6 w-1/3 border-r border-gray-700">
                        <span className="text-xs font-bold font-space-mono uppercase tracking-wider">
                          Features
                        </span>
                      </th>
                      <th className="py-6 px-6 w-1/3 bg-brand-primary border-r border-gray-700">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined">school</span>
                          <span className="font-bold text-white uppercase tracking-tight">
                            PlacePro
                          </span>
                        </div>
                      </th>
                      <th className="py-6 px-6 w-1/3">
                        <span className="font-bold text-gray-400 uppercase tracking-tight">
                          Legacy ERPs
                        </span>
                      </th>
                    </tr>
                  </thead>
                  <motion.tbody
                    variants={{
                      hidden: { opacity: 0 },
                      show: {
                        opacity: 1,
                        transition: { staggerChildren: 0.1, delayChildren: 0.4 }
                      }
                    }}
                    initial="hidden"
                    whileInView="show"
                    viewport={{ once: true }}
                    className="text-sm font-medium"
                  >
                    {[
                      { f: "Student Data Updates", p: "Real-time Sync", l: "Manual Batch Uploads" },
                      { f: "Resume Builder", p: "AI & Auto-Format", l: "Static PDF Upload only" },
                      { f: "Company Outreach", p: "Integrated Network", l: "Email/Phone only" },
                      { f: "Reporting", p: "Interactive & Granular", l: "Static Excel Dumps" }
                    ].map((row, i) => (
                      <motion.tr
                        key={i}
                        variants={{
                          hidden: { opacity: 0, y: 10 },
                          show: { opacity: 1, y: 0 }
                        }}
                        className="border-b border-black last:border-0"
                      >
                        <td className="py-5 px-6 border-r border-black font-bold text-black">
                          {row.f}
                        </td>
                        <td className="py-5 px-6 border-r border-black bg-blue-50 font-bold text-black flex items-center gap-2">
                          <span className="material-symbols-outlined text-brand-primary text-lg">
                            check_circle
                          </span>{" "}
                          {row.p}
                        </td>
                        <td className="py-5 px-6 text-gray-500">
                          {row.l}
                        </td>
                      </motion.tr>
                    ))}
                  </motion.tbody>
                </table>
              </motion.div>
            </div>
          </motion.section>

          {/* Pricing */}
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            id="pricing"
            className="py-20 bg-[#FAFAFA] border-y-2 border-black overflow-hidden"
          >
            <Pricing
              plans={demoPlans}
              title="Transparent Pricing"
              description="Simple, predictable pricing for institutions of all sizes."
            />
          </motion.section>

          {/* CTA Section */}
          <motion.section
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1 }}
            className="py-24 px-8 relative overflow-hidden bg-white text-black border-t-2 border-black"
          >
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage:
                  "linear-gradient(#eee 1px, transparent 1px), linear-gradient(90deg, #eee 1px, transparent 1px)",
                backgroundSize: "40px 40px",
              }}
            ></div>
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.8 }}
              className="max-w-[1000px] mx-auto text-center relative z-10"
            >
              <h2 className="font-serif text-4xl md:text-5xl lg:text-6xl mb-6 text-black">
                Transform <span className="italic font-light">Your Campus</span>
              </h2>
              <p className="text-gray-600 text-xl font-medium mb-10 max-w-2xl mx-auto">
                Join 500+ top-tier institutions modernizing their campus recruitment
                with PlacePro's infrastructure.
              </p>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="flex flex-col sm:flex-row justify-center items-center gap-6"
              >
                <Link
                  className="bg-brand-primary text-white px-8 py-4 border-2 border-black text-base font-bold hover:bg-black transition-all flex items-center gap-2 uppercase tracking-wide"
                  href="/signup"
                >
                  Start 14-day trial
                  <span className="material-symbols-outlined text-lg">
                    arrow_forward
                  </span>
                </Link>
                <Link
                  className="px-8 py-4 border-b-2 border-black text-base font-bold text-black hover:text-brand-primary hover:border-brand-primary transition-all flex items-center gap-2 uppercase tracking-wide"
                  href="/contact"
                >
                  Contact Sales
                </Link>
              </motion.div>
            </motion.div>
          </motion.section>

          {/* Visual Divider */}
          <div className="border-t-2 border-black w-full"></div>

          {/* Redesigned Premium Footer */}
          <footer className="relative bg-white pt-24 pb-12 overflow-hidden">
            <div className="max-w-7xl mx-auto px-10 relative z-10">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-16 mb-20">
                {/* Brand Column */}
                <div className="lg:col-span-5 space-y-8">
                  <div className="flex items-center gap-3">
                    <img src="/logo.png" alt="PlacePro" className="w-6 h-6 object-contain" />
                    <span className="text-lg font-bold tracking-tight text-black uppercase">PlacePro</span>
                  </div>
                  <p className="text-neutral-500 text-[15px] max-w-sm leading-relaxed">
                    Building the global infrastructure for next-generation
                    university-to-corporate talent pipelines. Elevating outcomes
                    for elite institutions.
                  </p>
                  <div className="inline-flex items-center px-3 py-1 bg-neutral-50 border border-neutral-200 rounded-full">
                    <span className="text-[11px] font-medium text-neutral-400">placepro.in</span>
                  </div>
                </div>

                {/* Links Columns */}
                <div className="lg:col-span-7 grid grid-cols-2 md:grid-cols-3 gap-12">
                  {[
                    { title: 'Explore', links: ['Features', 'Elite Dashboard', 'Smart Analytics', 'AI Resume Builder'] },
                    { title: 'Platform', links: ['Automated TPO', 'Success Stories', 'Engineering', 'Contact Sales'] },
                    { title: 'Legal', links: ['Privacy Policy', 'Terms of Service', 'Security Shield', 'SLA'] }
                  ].map((group) => (
                    <div key={group.title} className="space-y-6">
                      <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-neutral-400">{group.title}</h4>
                      <ul className="space-y-4">
                        {group.links.map((link) => (
                          <li key={link}>
                            <Link href="#" className="text-[14px] font-medium text-neutral-600 hover:text-blue-600 transition-colors">
                              {link}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom Bar */}
              <div className="pt-10 border-t border-neutral-100 flex flex-col md:flex-row justify-between items-center gap-6">
                <p className="text-[13px] text-neutral-400">
                  © 2026 PlacePro. All rights reserved.
                </p>
                <div className="text-[13px] text-neutral-400">
                  Design & Developed by <Link href="https://pranavgawai.in" className="text-blue-600 font-semibold hover:underline">pranavgawai</Link>
                </div>
              </div>
            </div>
          </footer>
        </div>

        {/* Right Sidebar */}
        <div className="hidden lg:block w-[64px] border-l-2 border-black dot-matrix-pattern relative shrink-0"></div>
      </div>
    </div>
  );
}

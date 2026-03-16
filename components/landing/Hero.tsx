"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function LandingHero() {
    return (
        <div className="relative z-10 flex flex-col items-center px-0 pb-8 pt-8 sm:px-4 sm:pb-6 sm:pt-10">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="mb-6 max-w-full rounded-md bg-gray-100 px-3 py-1.5 text-center text-[11px] font-medium tracking-wide text-gray-600 sm:px-4 sm:text-xs"
            >
                Placement Platform That Students Actually Love
            </motion.div>

            <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.1, ease: "easeOut" }}
                className="mb-5 max-w-[12.5ch] text-center font-serif text-[2.45rem] leading-[0.98] tracking-tight text-black sm:max-w-4xl sm:text-4xl sm:leading-[1.05] md:text-5xl lg:text-6xl"
            >
                Give Your Students a <span className="text-blue-600">Modern</span>
                <span className="block pt-1 italic font-light sm:pt-0">Job Application Experience</span>
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="mb-6 max-w-[34rem] px-1 text-center text-sm leading-7 text-gray-600 sm:px-4 sm:text-sm sm:leading-relaxed"
            >
                PlacePro isn't just admin software—students get a beautiful dashboard, AI resume builder, and real-time application tracking. Result? 3x higher engagement than traditional systems.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="relative mb-0 flex w-full max-w-md flex-col items-stretch gap-3 sm:max-w-none sm:flex-row sm:items-center"
            >
                <Link href="/signup">
                    <button className="relative w-full rounded-none bg-black px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-blue-600 sm:w-auto sm:text-xs">
                        Book a Strategy Demo
                        <div className="absolute top-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                    </button>
                </Link>
                <button className="relative w-full rounded-none bg-[#E5E5E5] px-6 py-3 text-sm font-medium text-black transition-colors hover:bg-[#d4d4d4] sm:w-auto sm:text-xs">
                    View 5-Minute Product Tour
                    <div className="absolute top-1 left-1 w-1 h-1 bg-black rounded-full"></div>
                    <div className="absolute top-1 right-1 w-1 h-1 bg-black rounded-full"></div>
                    <div className="absolute bottom-1 left-1 w-1 h-1 bg-black rounded-full"></div>
                    <div className="absolute bottom-1 right-1 w-1 h-1 bg-black rounded-full"></div>
                </button>
            </motion.div>
        </div>
    );
}

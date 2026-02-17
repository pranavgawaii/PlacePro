"use client";

import { motion } from "framer-motion";
import Link from "next/link";

export function LandingHero() {
    return (
        <div className="flex flex-col items-center pt-8 pb-4 relative z-10 px-4">
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
                className="font-serif text-4xl md:text-5xl lg:text-6xl text-center leading-[1.1] mb-4 max-w-4xl tracking-tight text-black"
            >
                Give Your Students a <span className="text-blue-600">Modern</span> <br />
                <span className="italic font-light">Job Application Experience</span>
            </motion.h1>

            <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                className="text-center text-gray-600 max-w-xl text-xs leading-relaxed mb-4 font-light px-4"
            >
                PlacePro isn't just admin software—students get a beautiful dashboard, AI resume builder, and real-time application tracking. Result? 3x higher engagement than traditional systems.
            </motion.p>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.3, ease: "easeOut" }}
                className="flex gap-3 mb-0 relative scale-90 md:scale-95 lg:scale-100"
            >
                <Link href="/signup">
                    <button className="bg-black text-white px-6 py-2.5 text-xs font-medium relative hover:bg-blue-600 transition-colors">
                        Book a Strategy Demo
                        <div className="absolute top-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute top-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 left-1 w-1 h-1 bg-white rounded-full"></div>
                        <div className="absolute bottom-1 right-1 w-1 h-1 bg-white rounded-full"></div>
                    </button>
                </Link>
                <button className="bg-[#E5E5E5] text-black px-6 py-2.5 text-xs font-medium hover:bg-[#d4d4d4] transition-colors relative">
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

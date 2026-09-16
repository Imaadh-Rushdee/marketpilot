"use client";
import {motion} from "framer-motion";
export function Reveal({children,className="",delay=0}:{children:React.ReactNode;className?:string;delay?:number}){return <motion.div className={className} initial={{opacity:0,y:28}} whileInView={{opacity:1,y:0}} viewport={{once:true,amount:.18}} transition={{duration:.65,delay,ease:[.22,1,.36,1]}}>{children}</motion.div>}
export function HeroMotion({children}:{children:React.ReactNode}){return <motion.div initial={{opacity:0,y:22}} animate={{opacity:1,y:0}} transition={{duration:.75,ease:[.22,1,.36,1]}}>{children}</motion.div>}
export function FloatPreview({children}:{children:React.ReactNode}){return <motion.div initial={{opacity:0,scale:.94,x:30}} animate={{opacity:1,scale:1,x:0}} transition={{duration:.85,ease:[.22,1,.36,1]}} whileHover={{y:-8,rotate:0}}>{children}</motion.div>}

import Image from "next/image";
import Link from "next/link";
import {ArrowRight} from "lucide-react";
import Logo from "./assets/logo.png";

export function MarketingNav(){return <header className="marketing-header"><Link className="marketing-brand" href="/" aria-label="MarketPilot home"><Image src={Logo} alt="MarketPilot" priority/></Link><nav aria-label="Public navigation"><Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link><Link href="/pricing">Pricing</Link></nav><div className="marketing-actions"><Link className="landing-link" href="/login">Sign in</Link><Link className="primary compact" href="/login">Start free <ArrowRight size={15}/></Link></div></header>}
export function MarketingFooter(){return <footer className="marketing-footer"><div><Image src={Logo} alt="MarketPilot"/><p>AI-assisted planning, creative and publishing for growing businesses.</p></div><div><strong>Product</strong><Link href="/features">Features</Link><Link href="/how-it-works">How it works</Link><Link href="/pricing">Pricing</Link></div><div><strong>Account</strong><Link href="/login">Sign in</Link><Link href="/login">Create account</Link></div><small>© {new Date().getFullYear()} MarketPilot. Built by Ivornox.</small></footer>}

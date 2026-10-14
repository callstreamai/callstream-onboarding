import ManagedOnboarding from "@/components/onboarding/ManagedOnboarding";
import {requireAdmin} from "@/lib/access";
import {redirect} from "next/navigation";
export default async function Page(){try{await requireAdmin();}catch{redirect("/submissions");}return <ManagedOnboarding/>;}

import {requireProject} from "@/lib/access";
import {redirect} from "next/navigation";
export default async function Layout({children,params}:{children:React.ReactNode;params:{jobId:string}}){try{await requireProject(params.jobId,true);}catch{redirect(`/onboarding/${params.jobId}/workspace`);}return children;}

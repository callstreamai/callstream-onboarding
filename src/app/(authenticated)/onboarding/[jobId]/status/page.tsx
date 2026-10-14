import {redirect} from "next/navigation";
export default function Page({params}:{params:{jobId:string}}){redirect("/properties/"+params.jobId);}

import { redirect } from "next/navigation";

export default function LegacyStrategyDetail({ params }: { params: { id: string } }) {
  redirect(`/us/strategy/${params.id}`);
}

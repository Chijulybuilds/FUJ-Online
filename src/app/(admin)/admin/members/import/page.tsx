import { PageHeading } from "@/components/ui/page-heading";
import { requireAdmin } from "@/lib/auth/session";
import { Importer } from "./importer";

export default async function ImportPage() {
  await requireAdmin("members");
  return (
    <>
      <PageHeading
        title="Import contacts"
        description="Add a contact list (Excel or CSV) to the database. You'll see who's new and who's already registered before anything is saved — people already in the database are skipped, so nobody is added twice."
      />
      <Importer />
    </>
  );
}

import { SignInForm } from "@/components/admin-forms";
import { canSignIn } from "@/lib/owner";

// Shown instead of an owner's page to anyone who is not the owner.
export function OwnerOnly() {
  return (
    <div className="rounded-xl border border-stone-300 bg-white p-6">
      <h1 className="text-lg font-semibold">This area is for the shop owner</h1>
      {canSignIn() ? (
        <>
          <p className="mt-2 text-sm text-stone-600">
            Sign in with the owner&apos;s password. If you are a customer,
            everything you need is in the shop.
          </p>
          <SignInForm />
        </>
      ) : (
        <p className="mt-2 text-sm text-stone-600">
          Orders and settings can only be opened on the computer the shop runs
          on. If you are a customer, everything you need is in the shop.
        </p>
      )}
    </div>
  );
}

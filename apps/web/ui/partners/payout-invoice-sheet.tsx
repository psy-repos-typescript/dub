import { confirmPayoutsAction } from "@/lib/actions/partners/confirm-payouts";
import { PAYOUT_FEES } from "@/lib/partners/constants";
import { mutatePrefix } from "@/lib/swr/mutate";
import usePaymentMethods from "@/lib/swr/use-payment-methods";
import usePayouts from "@/lib/swr/use-payouts";
import usePayoutsCount from "@/lib/swr/use-payouts-count";
import useWorkspace from "@/lib/swr/use-workspace";
import { PayoutsCount } from "@/lib/types";
import { X } from "@/ui/shared/icons";
import { PayoutStatus } from "@dub/prisma/client";
import {
  Button,
  buttonVariants,
  CreditCard,
  Gear,
  GreekTemple,
  Sheet,
  SimpleTooltipContent,
  Table,
  Tooltip,
  useRouterStuff,
  useTable,
} from "@dub/ui";
import {
  capitalize,
  cn,
  currencyFormatter,
  OG_AVATAR_URL,
  truncate,
} from "@dub/utils";
import { useAction } from "next-safe-action/hooks";
import { useParams } from "next/navigation";
import {
  Dispatch,
  Fragment,
  SetStateAction,
  useEffect,
  useMemo,
  useState,
} from "react";
import { toast } from "sonner";

interface PayoutInvoiceSheetProps {
  setIsOpen: Dispatch<SetStateAction<boolean>>;
}

function PayoutInvoiceSheetContent({ setIsOpen }: PayoutInvoiceSheetProps) {
  const { programId } = useParams() as { programId: string };
  const { id: workspaceId, slug, plan } = useWorkspace();
  const { paymentMethods, loading: paymentMethodsLoading } =
    usePaymentMethods();

  const paymentMethodsTypes = Object.freeze({
    link: {
      label: "link",
      type: "link",
      icon: CreditCard,
      fee: PAYOUT_FEES[plan?.split(" ")[0] ?? "business"].card,
      duration: "Instantly",
    },
    card: {
      label: "card",
      type: "card",
      icon: CreditCard,
      fee: PAYOUT_FEES[plan?.split(" ")[0] ?? "business"].card,
      duration: "Instantly",
    },
    us_bank_account: {
      label: "ACH",
      type: "us_bank_account",
      icon: GreekTemple,
      fee: PAYOUT_FEES[plan?.split(" ")[0] ?? "business"].ach,
      duration: "4 business days",
    },
  });

  type PaymentMethodWithFee =
    (typeof paymentMethodsTypes)[keyof typeof paymentMethodsTypes] & {
      id: string;
    };

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethodWithFee | null>(null);

  const {
    payoutsCount: eligiblePayoutsCount,
    loading: eligiblePayoutsCountLoading,
  } = usePayoutsCount<PayoutsCount[]>({
    groupBy: "status",
    eligibility: "eligible",
  });

  const {
    payouts: eligiblePayouts,
    error: eligiblePayoutsError,
    loading: eligiblePayoutsLoading,
  } = usePayouts({
    query: {
      status: "pending",
      eligibility: "eligible",
      sortBy: "amount",
    },
  });

  const { executeAsync, isPending } = useAction(confirmPayoutsAction, {
    onSuccess: async () => {
      await mutatePrefix(`/api/programs/${programId}/payouts`);
      toast.success(
        "Payouts confirmed successfully! They will be processed soon.",
      );
      setIsOpen(false);
    },
    onError({ error }) {
      toast.error(error.serverError);
    },
  });

  // Set the first payment method as the selected payment method
  useEffect(() => {
    if (!paymentMethods || !paymentMethods.length) {
      return;
    }

    if (!selectedPaymentMethod) {
      const firstPaymentMethod = paymentMethods[0];
      setSelectedPaymentMethod({
        ...paymentMethodsTypes[firstPaymentMethod.type],
        id: firstPaymentMethod.id,
      });
    }
  }, [paymentMethods, selectedPaymentMethod]);

  const paymentMethodsWithFee = useMemo(
    () =>
      paymentMethods?.map((pm) => ({
        ...paymentMethodsTypes[pm.type],
        id: pm.id,
        title: pm.link
          ? `Link – ${truncate(pm.link.email, 16)}`
          : pm.card
            ? `${capitalize(pm.card?.brand)} **** ${pm.card?.last4}`
            : `ACH **** ${pm.us_bank_account?.last4}`,
      })),
    [paymentMethods],
  );

  const invoiceData = useMemo(() => {
    if (eligiblePayoutsCountLoading) {
      return {
        Method: (
          <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
        ),
        Amount: (
          <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
        ),
        Fee: (
          <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
        ),
        Duration: (
          <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
        ),
        Total: (
          <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
        ),
      };
    }

    const amount =
      eligiblePayoutsCount?.find((p) => p.status === PayoutStatus.pending)
        ?.amount ?? 0;

    const fee = amount * (selectedPaymentMethod?.fee ?? 0);
    const total = amount + fee;

    return {
      Method: (
        <div className="flex items-center gap-2 pr-6">
          {paymentMethodsLoading ? (
            <div className="h-[30px] w-full animate-pulse rounded-md bg-neutral-200" />
          ) : (
            <select
              className="h-auto flex-1 rounded-md border border-neutral-200 py-1.5 text-xs focus:border-neutral-600 focus:ring-neutral-600"
              value={selectedPaymentMethod?.id || ""}
              onChange={(e) =>
                setSelectedPaymentMethod(
                  paymentMethodsWithFee?.find(
                    (pm) => pm.id === e.target.value,
                  ) || null,
                )
              }
            >
              {paymentMethodsWithFee?.map(({ id, title }) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          )}
          <a
            href={`/${slug}/settings/billing`}
            className={cn(
              buttonVariants({ variant: "secondary" }),
              "flex items-center rounded-md border border-neutral-200 px-2 py-1.5 text-sm",
            )}
            target="_blank"
          >
            <Gear className="size-4" />
          </a>
        </div>
      ),

      Amount: currencyFormatter(amount / 100, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),

      Fee: selectedPaymentMethod ? (
        <Tooltip
          content={
            <SimpleTooltipContent
              title={`${Math.round(selectedPaymentMethod.fee * 100)}% processing fee.${selectedPaymentMethod.type !== "us_bank_account" ? " Switch to ACH for a reduced fee." : ""}`}
              cta="Learn more"
              href="https://d.to/payouts"
            />
          }
        >
          <span className="underline decoration-dotted underline-offset-2">
            {currencyFormatter(fee / 100, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        </Tooltip>
      ) : (
        <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
      ),

      Duration: (
        <div>
          {selectedPaymentMethod ? (
            selectedPaymentMethod?.duration
          ) : (
            <div className="h-4 w-24 animate-pulse rounded-md bg-neutral-200" />
          )}
        </div>
      ),

      Total: currencyFormatter(total / 100, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    };
  }, [
    eligiblePayoutsCount,
    eligiblePayoutsCountLoading,
    paymentMethods,
    selectedPaymentMethod,
  ]);
  const table = useTable({
    data: eligiblePayouts || [],
    columns: [
      {
        header: "Partner",
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <img
              src={
                row.original.partner.image ||
                `${OG_AVATAR_URL}${row.original.partner.name}`
              }
              alt={row.original.partner.name}
              className="size-6 rounded-full"
            />
            <span className="text-sm text-neutral-700">
              {row.original.partner.name}
            </span>
          </div>
        ),
      },
      {
        id: "total",
        header: "Total",
        cell: ({ row }) =>
          currencyFormatter(row.original.amount / 100, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
    ],
    thClassName: (id) =>
      cn(id === "total" && "[&>div]:justify-end", "border-l-0"),
    tdClassName: (id) => cn(id === "total" && "text-right", "border-l-0"),
    className: "[&_tr:last-child>td]:border-b-transparent",
    scrollWrapperClassName: "min-h-[40px]",
    resourceName: (p) => `pending payout${p ? "s" : ""}`,
    loading: eligiblePayoutsLoading,
    error: eligiblePayoutsError
      ? "Failed to load payouts for this invoice."
      : undefined,
  } as any);

  useEffect(() => {
    if (eligiblePayouts) {
      table.table.toggleAllRowsSelected();
    }
  }, [eligiblePayouts]);

  return (
    <>
      <div>
        <div className="flex items-start justify-between border-b border-neutral-200 p-6">
          <Sheet.Title className="text-xl font-semibold">
            Payout invoice
          </Sheet.Title>
          <Sheet.Close asChild>
            <Button
              variant="outline"
              icon={<X className="size-5" />}
              className="h-auto w-fit p-1"
            />
          </Sheet.Close>
        </div>
        <div className="flex flex-col gap-4 p-6">
          <div className="text-base font-medium text-neutral-900">
            Invoice details
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {Object.entries(invoiceData).map(([key, value]) => (
              <Fragment key={key}>
                <div className="flex items-end font-medium text-neutral-500">
                  {key}
                </div>
                <div className="text-neutral-800">{value}</div>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="p-6 pt-2">
          <Table {...table} />
        </div>
      </div>
      <div className="flex grow flex-col justify-end">
        <div className="flex items-center justify-end gap-2 border-t border-neutral-200 p-5">
          <Button
            type="button"
            variant="secondary"
            onClick={() => setIsOpen(false)}
            text="Close"
            className="w-fit"
          />
          <Button
            type="button"
            variant="primary"
            loading={isPending}
            onClick={async () => {
              if (!workspaceId || !selectedPaymentMethod) {
                return;
              }

              await executeAsync({
                workspaceId,
                paymentMethodId: selectedPaymentMethod.id,
              });
            }}
            text="Confirm payout"
            className="w-fit"
          />
        </div>
      </div>
    </>
  );
}

export function PayoutInvoiceSheet({
  isOpen,
  setIsOpen,
}: PayoutInvoiceSheetProps & {
  isOpen: boolean;
}) {
  const { queryParams } = useRouterStuff();

  return (
    <Sheet
      open={isOpen}
      onOpenChange={setIsOpen}
      onClose={() => {
        queryParams({ del: "payoutId", scroll: false });
      }}
    >
      <PayoutInvoiceSheetContent setIsOpen={setIsOpen} />
    </Sheet>
  );
}

export function usePayoutInvoiceSheet() {
  const [isOpen, setIsOpen] = useState(false);

  return {
    payoutInvoiceSheet: (
      <PayoutInvoiceSheet isOpen={isOpen} setIsOpen={setIsOpen} />
    ),
    setIsOpen,
  };
}

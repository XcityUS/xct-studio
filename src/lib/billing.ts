export const XCITY_BILLING_URL = 'https://xcity.ai/dashboard/billing';

export function isBudgetExceededMessage(message: string | null | undefined): boolean {
    if (!message) return false;

    return /budget (has been )?exceeded|budget_exceeded|insufficient (credits|balance|budget)|余额不足|额度(已)?用完|预算(已)?用完/i.test(
        message
    );
}

export function shouldShowBillingAction(message: string | null | undefined): boolean {
    if (!message) return false;

    return isBudgetExceededMessage(message) || /rate-?limited|higher RPM|限流|频率限制|升级|充值/i.test(message);
}

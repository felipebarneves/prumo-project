import os
import stripe
from typing import Optional

stripe.api_key = os.environ.get("STRIPE_SECRET_KEY", "")

def verify_organization_subscription(stripe_customer_id: Optional[str]) -> bool:
    """
    Verifica se a organização possui uma assinatura ativa no Stripe.
    """
    if not stripe.api_key or not stripe_customer_id:
        return False
        
    try:
        subscriptions = stripe.Subscription.list(
            customer=stripe_customer_id,
            status="active",
            limit=1
        )
        return len(subscriptions.data) > 0
    except Exception as e:
        print(f"Erro ao consultar Stripe: {e}")
        return False
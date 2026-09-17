with orders as (
    select * from {{ ref('stg_orders') }}
),

payments as (
    select * from {{ ref('stg_payments') }}
),

order_payments as (
    select
        order_id,
        sum(payment_value) as total_payment_value,
        count(payment_sequential) as payment_count
    from payments
    group by 1
)

select
    o.order_id,
    o.customer_id,
    o.order_status,
    o.purchase_at,
    o.approved_at,
    o.delivered_carrier_at,
    o.delivered_customer_at,
    o.estimated_delivery_at,
    coalesce(op.total_payment_value, 0) as total_payment_value,
    coalesce(op.payment_count, 0) as payment_count
from orders o
left join order_payments op on o.order_id = op.order_id

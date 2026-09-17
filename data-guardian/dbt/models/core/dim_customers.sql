with customers as (
    select * from {{ ref('stg_customers') }}
),

orders as (
    select * from {{ ref('stg_orders') }}
),

customer_orders as (
    select
        customer_id,
        min(purchase_at) as first_order_at,
        max(purchase_at) as most_recent_order_at,
        count(order_id) as number_of_orders
    from orders
    group by 1
)

select
    c.customer_id,
    c.customer_unique_id,
    c.zip_code,
    c.city,
    c.state,
    coalesce(co.number_of_orders, 0) as number_of_orders,
    co.first_order_at,
    co.most_recent_order_at
from customers c
left join customer_orders co on c.customer_id = co.customer_id

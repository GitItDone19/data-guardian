with source as (
    select * from {{ source('raw', 'payments') }}
),

deduplicated as (
    select
        order_id,
        payment_sequential,
        payment_type,
        payment_installments,
        payment_value,
        row_number() over (
            partition by order_id, payment_sequential
            order by payment_value desc
        ) as rn
    from source
)

select
    order_id,
    payment_sequential,
    payment_type,
    payment_installments,
    cast(payment_value as numeric(10, 2)) as payment_value
from deduplicated
where rn = 1

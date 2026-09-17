with source as (
    select * from {{ source('raw', 'payments') }}
)

select
    order_id,
    payment_sequential,
    payment_type,
    payment_installments,
    cast(payment_value as numeric(10, 2)) as payment_value
from source

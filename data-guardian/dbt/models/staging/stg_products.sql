with products as (
    select * from {{ source('raw', 'products') }}
),

translations as (
    select * from {{ source('raw', 'product_category_name_translation') }}
)

select
    p.product_id,
    coalesce(t.product_category_name_english, p.product_category_name, 'unknown') as category_name,
    p.product_weight_g as weight_g,
    p.product_length_cm as length_cm,
    p.product_height_cm as height_cm,
    p.product_width_cm as width_cm
from products p
left join translations t on p.product_category_name = t.product_category_name

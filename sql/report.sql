select temp, rpm, in_amount, out_amount from (
  select plc_id, temp, rpm, in_amount, out_amount from plcdata1
  where plc_id is not null
) a order by plc_id desc limit 1

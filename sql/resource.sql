select * from (
select res_id, res_code, max(status_disp) status_disp
from "MCW_MST_RESOURCE"
group by res_id, res_code
) a

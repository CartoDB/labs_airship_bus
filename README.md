Airship - Moving assets example
==================================0

## Data

Get only the first position of each bus

```sql
with firsts as (
  select cartodb_id,
         rank() over (partition by codbus order by last_update) as rank
    from malaga_buses
) select m.*
    from malaga_buses m
    join firsts f
      on f.cartodb_id = m.cartodb_id
     and rank = 1
```

Update the `delta_update` field to reflect the number of seconds from the first data appeared

```sql
update malaga_buses set
delta_update = 
	   extract( 'hour' from (last_update - '2018-09-14T13:19:05Z')) * 3600 + 
       extract( 'minute' from (last_update - '2018-09-14T13:19:05Z')) * 60 +
       extract( 'second' from (last_update - '2018-09-14T13:19:05Z'));
create index malaga_buses_delta on malaga_buses(delta_update);
```

Remove anything exceding 6 hours

```sql
delete from malaga_buses where delta_update > (3600*6)
```

Query the data from the table based in groups of 4 (24/6) iterations and current date:

```sql
with now as ( -- seconds from the last reset (modulus of hour by 4)
 select 
  	(extract('hour' from '2018-09-20T14:04:30Z'::timestamp)::numeric % 4 ) * 3600 + 
    (extract('minute' from '2018-09-20T14:04:30Z'::timestamp) * 60) + 
    (round(extract('seconds' from '2018-09-20T14:04:30Z'::timestamp))) as value 
),
firsts as ( -- filtering the last two minutes of the delta, get only the identifiers of the first occurrence
  select cartodb_id,
         rank() over (partition by codbus order by delta_update desc) as rank
    from malaga_buses, now
  where delta_update between now.value - 120 and now.value
) -- get the full rows of the filtered identifiers
select m.*
    from malaga_buses m
    join firsts f
      on f.cartodb_id = m.cartodb_id
     and rank = 1
```

Faking companies

```sql
create table malaga_buses_companies as 
with codes as (
  select distinct codbus from malaga_buses 
), companies as (
  select round(codbus / 100 ) as id from codes
)
select distinct id, '' as name  from companies group by id;
select cdb_cartodbfytable('jsanzcdb','malaga_buses_companies');
```

and then adding manually some stupid names for the companies generated
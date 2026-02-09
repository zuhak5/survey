-- Best-effort backfill of governorate codes for existing submissions.
-- Uses stored reverse-geocode labels (start_label/end_label) when present.

update public.submissions
set start_governorate_code = case
  when start_label ilike '%بغداد%' or start_label ilike '%baghdad%' then 'baghdad'
  when start_label ilike '%البصرة%' or start_label ilike '%البصره%' or start_label ilike '%basra%' then 'basra'
  when start_label ilike '%نينوى%' or start_label ilike '%nineveh%' then 'nineveh'
  when start_label ilike '%الأنبار%' or start_label ilike '%الانبار%' or start_label ilike '%anbar%' then 'anbar'
  when start_label ilike '%ديالى%' or start_label ilike '%دياله%' or start_label ilike '%diyala%' then 'diyala'
  when start_label ilike '%بابل%' or start_label ilike '%babil%' then 'babil'
  when start_label ilike '%كربلاء%' or start_label ilike '%كربلا%' or start_label ilike '%karbala%' then 'karbala'
  when start_label ilike '%النجف%' or start_label ilike '%najaf%' then 'najaf'
  when start_label ilike '%القادسية%' or start_label ilike '%القادسيه%' or start_label ilike '%qadisiyyah%' then 'qadisiyyah'
  when start_label ilike '%المثنى%' or start_label ilike '%المثني%' or start_label ilike '%muthanna%' then 'muthanna'
  when start_label ilike '%ذي قار%' or start_label ilike '%ذيقار%' or start_label ilike '%dhi qar%' then 'dhi_qar'
  when start_label ilike '%ميسان%' or start_label ilike '%maysan%' then 'maysan'
  when start_label ilike '%واسط%' or start_label ilike '%wasit%' then 'wasit'
  when start_label ilike '%صلاح الدين%' or start_label ilike '%salah%' then 'salah_al_din'
  when start_label ilike '%كركوك%' or start_label ilike '%kirkuk%' then 'kirkuk'
  when start_label ilike '%أربيل%' or start_label ilike '%اربيل%' or start_label ilike '%erbil%' then 'erbil'
  when start_label ilike '%السليمانية%' or start_label ilike '%السليمانيه%' or start_label ilike '%sulaymaniyah%' then 'sulaymaniyah'
  when start_label ilike '%دهوك%' or start_label ilike '%duhok%' then 'duhok'
  else start_governorate_code
end
where start_governorate_code is null
  and start_label is not null;

update public.submissions
set end_governorate_code = case
  when end_label ilike '%بغداد%' or end_label ilike '%baghdad%' then 'baghdad'
  when end_label ilike '%البصرة%' or end_label ilike '%البصره%' or end_label ilike '%basra%' then 'basra'
  when end_label ilike '%نينوى%' or end_label ilike '%nineveh%' then 'nineveh'
  when end_label ilike '%الأنبار%' or end_label ilike '%الانبار%' or end_label ilike '%anbar%' then 'anbar'
  when end_label ilike '%ديالى%' or end_label ilike '%دياله%' or end_label ilike '%diyala%' then 'diyala'
  when end_label ilike '%بابل%' or end_label ilike '%babil%' then 'babil'
  when end_label ilike '%كربلاء%' or end_label ilike '%كربلا%' or end_label ilike '%karbala%' then 'karbala'
  when end_label ilike '%النجف%' or end_label ilike '%najaf%' then 'najaf'
  when end_label ilike '%القادسية%' or end_label ilike '%القادسيه%' or end_label ilike '%qadisiyyah%' then 'qadisiyyah'
  when end_label ilike '%المثنى%' or end_label ilike '%المثني%' or end_label ilike '%muthanna%' then 'muthanna'
  when end_label ilike '%ذي قار%' or end_label ilike '%ذيقار%' or end_label ilike '%dhi qar%' then 'dhi_qar'
  when end_label ilike '%ميسان%' or end_label ilike '%maysan%' then 'maysan'
  when end_label ilike '%واسط%' or end_label ilike '%wasit%' then 'wasit'
  when end_label ilike '%صلاح الدين%' or end_label ilike '%salah%' then 'salah_al_din'
  when end_label ilike '%كركوك%' or end_label ilike '%kirkuk%' then 'kirkuk'
  when end_label ilike '%أربيل%' or end_label ilike '%اربيل%' or end_label ilike '%erbil%' then 'erbil'
  when end_label ilike '%السليمانية%' or end_label ilike '%السليمانيه%' or end_label ilike '%sulaymaniyah%' then 'sulaymaniyah'
  when end_label ilike '%دهوك%' or end_label ilike '%duhok%' then 'duhok'
  else end_governorate_code
end
where end_governorate_code is null
  and end_label is not null;


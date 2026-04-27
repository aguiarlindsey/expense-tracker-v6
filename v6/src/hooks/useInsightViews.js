import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../utils/supabase'

export function useInsightViews(userId, refreshTrigger) {
  const [monthlyExp, setMonthlyExp] = useState([])
  const [monthlyInc, setMonthlyInc] = useState([])
  const [yearlyExp,  setYearlyExp]  = useState([])

  const fetch = useCallback(async () => {
    if (!userId) return
    const [me, mi, ye] = await Promise.all([
      supabase.from('v_monthly_expenses').select('month,total').order('month'),
      supabase.from('v_monthly_income').select('month,total').order('month'),
      supabase.from('v_yearly_expenses').select('year,total').order('year'),
    ])
    if (me.data) setMonthlyExp(me.data)
    if (mi.data) setMonthlyInc(mi.data)
    if (ye.data) setYearlyExp(ye.data)
  }, [userId])

  useEffect(() => { fetch() }, [fetch, refreshTrigger])

  return { monthlyExp, monthlyInc, yearlyExp, refetchViews: fetch }
}

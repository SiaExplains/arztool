import { describe, expect, it } from 'vitest'
import { quarantineValue, ZONE_IDENTIFIER } from '../../src/main/download-mark'

describe('download marks', () => {
  it('builds a macOS quarantine value without any URL', () => {
    const value = quarantineValue(new Date('2026-10-02T12:00:00Z'), 'abc-def')
    expect(value).toBe(`0081;${(1790942400).toString(16)};Arztool;ABC-DEF`)
  })

  it('marks Windows downloads as Internet zone and nothing else', () => {
    expect(ZONE_IDENTIFIER).toBe('[ZoneTransfer]\r\nZoneId=3\r\n')
    expect(ZONE_IDENTIFIER).not.toMatch(/Url/i)
  })
})

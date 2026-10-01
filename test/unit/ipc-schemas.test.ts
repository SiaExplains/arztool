import { describe, expect, it } from 'vitest'
import { IpcChannel } from '@shared/ipc/channels'
import { IpcRequestSchemas } from '@shared/ipc/schemas'

describe('IPC request schemas', () => {
  it('has a schema for every channel', () => {
    expect(Object.keys(IpcRequestSchemas).sort()).toEqual(Object.values(IpcChannel).sort())
  })

  it('app:get-info accepts no payload and rejects anything else', () => {
    const schema = IpcRequestSchemas[IpcChannel.AppGetInfo]
    expect(schema.safeParse(undefined).success).toBe(true)
    expect(schema.safeParse({}).success).toBe(false)
    expect(schema.safeParse('x').success).toBe(false)
  })
})

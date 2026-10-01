import { z } from 'zod'
import { IpcChannel, type IpcContract } from './channels'

/**
 * Runtime validation for every inbound IPC payload. The `satisfies` clause
 * makes the build fail if a channel is added to the contract without a schema,
 * or if a schema drifts from its declared request type.
 */
export const IpcRequestSchemas = {
  [IpcChannel.AppGetInfo]: z.undefined(),
} as const satisfies { [C in keyof IpcContract]: z.ZodType<IpcContract[C]['request']> }

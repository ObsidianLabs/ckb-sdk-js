import { ArgumentRequired } from '@nervosnetwork/ckb-sdk-utils/lib/exceptions'
import signWitnessGroup from './signWitnessGroup'
import groupScripts from './groupScripts'

type SignatureProvider = string | ((message: string | Uint8Array) => Promise<string>)
type LockHash = string
type TransactionHash = string
type CachedLock = Pick<CachedCell, 'lock'>

export interface SignWitnesses {
  (key: SignatureProvider): (params: { transactionHash: TransactionHash; witnesses: StructuredWitness[] }) => Promise<StructuredWitness[]>
  (key: Map<LockHash, SignatureProvider>): (params: {
    transactionHash: TransactionHash
    witnesses: StructuredWitness[]
    inputCells: CachedLock[]
  }) => Promise<StructuredWitness[]>
  (key: SignatureProvider | Map<LockHash, SignatureProvider>): (params: {
    transactionHash: TransactionHash
    witnesses: StructuredWitness[]
    inputCells?: CachedLock[]
  }) => Promise<StructuredWitness[]>
}

export const isMap = <K = any, V = any>(val: any): val is Map<K, V> => {
  return val.size !== undefined
}

const signWitnesses: SignWitnesses = (key: SignatureProvider | Map<LockHash, SignatureProvider>) => async ({
  transactionHash,
  witnesses = [],
  inputCells = [],
}: {
  transactionHash: string
  witnesses: StructuredWitness[]
  inputCells: CachedLock[]
}) => {
  if (!key) throw new ArgumentRequired('Signature provider')
  if (!transactionHash) throw new ArgumentRequired('Transaction hash')
  if (!witnesses.length) throw new Error('Witnesses is empty')

  if (isMap(key)) {
    const rawWitnesses = witnesses
    const restWitnesses = witnesses.slice(inputCells.length)
    const groupedScripts = groupScripts(inputCells)
    for (const [lockhash, indices] of groupedScripts) {
      const sk = key.get(lockhash)
      if (!sk) {
        throw new Error(`The signature provider to sign lockhash ${lockhash} is not found`)
      }
      const ws = [...indices.map(idx => witnesses[idx]), ...restWitnesses]

      const witnessIncludeSignature = await signWitnessGroup(sk, transactionHash, ws)[0]
      rawWitnesses[indices[0]] = witnessIncludeSignature
    }
    return rawWitnesses
  }

  const signedWitnesses = await signWitnessGroup(key, transactionHash, witnesses)
  return signedWitnesses
}

export default signWitnesses

import { useState } from 'react';
import {
  isNorwayWellboreDataset,
  convertNorwayWellboreRowsToImportRows,
  type NorwayFactpagesAdapterOptions,
  type NorwayAdapterIssue,
} from '../domain/norwayFactpagesAdapter';
import { parseCsvText, validateImportedDataset, type DatasetImportPreview } from '../domain/mlDatasetImport';

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

export interface NorwayAdapterActions {
  isNorwayDataset: boolean;
  setIsNorwayDataset: SetState<boolean>;
  norwayRawRows: Record<string, string>[];
  setNorwayRawRows: SetState<Record<string, string>[]>;
  norwayDiscoveryRows: Record<string, string>[];
  setNorwayDiscoveryRows: SetState<Record<string, string>[]>;
  norwayReserveRows: Record<string, string>[];
  setNorwayReserveRows: SetState<Record<string, string>[]>;
  norwayDescriptionRows: Record<string, string>[];
  setNorwayDescriptionRows: SetState<Record<string, string>[]>;
  norwayFieldRows: Record<string, string>[];
  setNorwayFieldRows: SetState<Record<string, string>[]>;
  norwayAdapterIssues: NorwayAdapterIssue[];
  resetNorwayState: () => void;
  handleNorwayEnrichmentFile: (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: SetState<Record<string, string>[]>,
  ) => void;
  handleNorwayConvert: () => void;
}

export function useNorwayAdapter(params: {
  setImportPreview: SetState<DatasetImportPreview | null>;
  setImportError: SetState<string | null>;
}): NorwayAdapterActions {
  const { setImportPreview, setImportError } = params;

  const [isNorwayDataset, setIsNorwayDataset] = useState(false);
  const [norwayRawRows, setNorwayRawRows] = useState<Record<string, string>[]>([]);
  const [norwayDiscoveryRows, setNorwayDiscoveryRows] = useState<Record<string, string>[]>([]);
  const [norwayReserveRows, setNorwayReserveRows] = useState<Record<string, string>[]>([]);
  const [norwayDescriptionRows, setNorwayDescriptionRows] = useState<Record<string, string>[]>([]);
  const [norwayFieldRows, setNorwayFieldRows] = useState<Record<string, string>[]>([]);
  const [norwayAdapterIssues, setNorwayAdapterIssues] = useState<NorwayAdapterIssue[]>([]);

  const resetNorwayState = () => {
    setIsNorwayDataset(false);
    setNorwayRawRows([]);
    setNorwayAdapterIssues([]);
  };

  const handleNorwayEnrichmentFile = (
    e: React.ChangeEvent<HTMLInputElement>,
    setter: SetState<Record<string, string>[]>,
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const { rows } = parseCsvText(evt.target?.result as string);
        setter(rows);
      } catch { /* ignore */ }
    };
    reader.readAsText(file);
  };

  const handleNorwayConvert = () => {
    const options: NorwayFactpagesAdapterOptions = {};
    if (norwayDiscoveryRows.length) options.discoveryRows = norwayDiscoveryRows;
    if (norwayReserveRows.length) options.reserveRows = norwayReserveRows;
    if (norwayDescriptionRows.length) options.descriptionRows = norwayDescriptionRows;
    if (norwayFieldRows.length) options.fieldRows = norwayFieldRows;

    const result = convertNorwayWellboreRowsToImportRows(norwayRawRows, options);
    setNorwayAdapterIssues(result.issues);

    if (!result.rows.length) {
      setImportError('Norway adapter produced no convertible rows. Check that the file is a wellbore_exploration_all export from Sokkeldirektoratet FactPages.');
      setIsNorwayDataset(false);
      return;
    }

    const convertedHeaders = Object.keys(result.rows[0]);
    const preview = validateImportedDataset(convertedHeaders, result.rows);
    const adapterMessages = result.issues
      .filter((i) => !preview.issues.some((pi) => pi.message === i.message))
      .map((i) => ({ severity: i.severity as 'info' | 'warning' | 'critical', message: i.message }));
    preview.issues.unshift(...adapterMessages);
    setImportPreview(preview);
    setIsNorwayDataset(false);
  };

  return {
    isNorwayDataset,
    setIsNorwayDataset,
    norwayRawRows,
    setNorwayRawRows,
    norwayDiscoveryRows,
    setNorwayDiscoveryRows,
    norwayReserveRows,
    setNorwayReserveRows,
    norwayDescriptionRows,
    setNorwayDescriptionRows,
    norwayFieldRows,
    setNorwayFieldRows,
    norwayAdapterIssues,
    resetNorwayState,
    handleNorwayEnrichmentFile,
    handleNorwayConvert,
  };
}

export { isNorwayWellboreDataset };

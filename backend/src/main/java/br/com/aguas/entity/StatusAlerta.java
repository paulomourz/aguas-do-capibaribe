package br.com.aguas.entity;

/** Valores aceitos por alerta.status (CHECK no banco). */
public enum StatusAlerta {
    aberto,
    analise,
    resolvido;

    /** Transições oferecidas pela tela de detalhe do alerta. "resolvido" é final. */
    public boolean podeIrPara(StatusAlerta novo) {
        return switch (this) {
            case aberto -> novo == analise || novo == resolvido;
            case analise -> novo == resolvido;
            case resolvido -> false;
        };
    }
}
